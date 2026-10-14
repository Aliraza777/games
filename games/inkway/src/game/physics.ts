import { Box, Chain, Circle, Polygon, Vec2, WheelJoint, World, type Body, type Contact, type Fixture } from 'planck';
import { clamp, type Vec } from '../lib/math';
import { GRAVITY, INKS, type InkKind, type VehicleSpec } from './config';
import { forwardOrder } from './ink';
import type { Platform, Updraft } from './worldgen';

/** Slowest relaunch from bounce ink, in m/s — even a gentle roll onto a pad pops you up. */
export const BOUNCE_MIN_SPEED = 9;
/** Contacts whose normal points this far downward (from ink to vehicle) pass through. */
export const ONE_WAY_COS = 0.25;
/** Tilt beyond which a head contact means a crash (cos 60°). */
export const CRASH_COS = 0.5;

type Tag =
  | { type: 'platform' }
  | { type: 'ink'; kind: InkKind }
  | { type: 'wheel'; index: number }
  | { type: 'head' }
  | { type: 'chassis' };

const tag = (f: Fixture) => f.getUserData() as Tag | undefined;
const isGround = (t?: Tag) => t?.type === 'platform' || t?.type === 'ink';

export interface Controls {
  /** -1 (brake/reverse) .. 1 (full gas). */
  throttle: number;
  /** -1 (lean forward) .. 1 (lean back). */
  lean: number;
  hop: boolean;
}

export interface VehicleState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  wheels: { x: number; y: number; angle: number }[];
  grounded: boolean;
  /** Ink (or terrain) the wheels are touching, if any. */
  surface: InkKind | 'platform' | null;
  crashed: boolean;
}

/** Thin wrapper over planck: one vehicle, terrain, and ink strokes. */
export class Physics {
  readonly world: World;
  readonly chassis: Body;
  readonly wheels: Body[];
  private joints: WheelJoint[];
  private platforms = new Map<number, Body>();
  private strokes = new Map<number, Body>();
  private wheelContacts = [0, 0];
  private surfaces: (InkKind | 'platform' | null)[] = [null, null];
  private crashed = false;
  private headContacts = 0;
  private hopCooldown = 0;
  private bounceCooldown = 0;
  /** Pending relaunch from bounce ink: unit normal (away from the ink) and speed. */
  private pendingBounce: { nx: number; ny: number; speed: number } | null = null;
  /** Called once per bounce-ink contact (for sound/particles). */
  onBounce: (() => void) | null = null;

  constructor(
    readonly spec: VehicleSpec,
    start: Vec,
  ) {
    this.world = new World({ gravity: new Vec2(0, GRAVITY) });
    const { chassis: c, wheel: w } = spec;

    this.chassis = this.world.createBody({ type: 'dynamic', position: new Vec2(start.x, start.y), angularDamping: 0.6 });
    this.chassis.createFixture({
      shape: new Box(c.w / 2, c.h / 2),
      density: c.density,
      friction: 0.6,
      userData: { type: 'chassis' } satisfies Tag,
    });
    // A rounded cabin/rider block so roof landings register.
    this.chassis.createFixture({
      shape: new Polygon([
        new Vec2(-c.w * 0.3, c.h / 2),
        new Vec2(c.w * 0.25, c.h / 2),
        new Vec2(c.w * 0.12, c.h / 2 + 0.35),
        new Vec2(-c.w * 0.22, c.h / 2 + 0.35),
      ]),
      density: c.density * 0.3,
      friction: 0.6,
      userData: { type: 'chassis' } satisfies Tag,
    });
    this.chassis.createFixture({
      shape: new Circle(new Vec2(spec.head.x, spec.head.y), spec.head.r),
      isSensor: true,
      userData: { type: 'head' } satisfies Tag,
    });

    this.wheels = w.x.map((wx, index) => {
      const body = this.world.createBody({
        type: 'dynamic',
        position: new Vec2(start.x + wx, start.y + w.y),
        angularDamping: 0.2,
      });
      body.createFixture({
        shape: new Circle(w.r),
        density: w.density,
        friction: w.friction,
        userData: { type: 'wheel', index } satisfies Tag,
      });
      return body;
    });

    this.joints = this.wheels.map((wheel) =>
      this.world.createJoint(
        new WheelJoint(
          {
            enableMotor: true,
            motorSpeed: 0,
            maxMotorTorque: spec.motor.torque,
            frequencyHz: spec.suspension.hz,
            dampingRatio: spec.suspension.damping,
          },
          this.chassis,
          wheel,
          wheel.getPosition(),
          new Vec2(0, 1),
        ),
      )!,
    ) as WheelJoint[];

    this.world.on('begin-contact', (contact) => this.contact(contact, 1));
    this.world.on('end-contact', (contact) => this.contact(contact, -1));
    this.world.on('pre-solve', (contact) => this.preSolve(contact));
  }

  private contact(c: Contact, delta: 1 | -1) {
    const a = tag(c.getFixtureA()), b = tag(c.getFixtureB());
    for (const [self, other] of [
      [a, b],
      [b, a],
    ] as const) {
      if (!isGround(other)) continue;
      if (self?.type === 'wheel') {
        this.wheelContacts[self.index] = Math.max(0, this.wheelContacts[self.index] + delta);
        if (delta > 0) this.surfaces[self.index] = other!.type === 'ink' ? other!.kind : 'platform';
        if (this.wheelContacts[self.index] === 0) this.surfaces[self.index] = null;
      }
      if (self?.type === 'head') this.headContacts = Math.max(0, this.headContacts + delta);
      if (delta > 0 && other?.type === 'ink' && other.kind === 'bounce' && (self?.type === 'wheel' || self?.type === 'chassis')) {
        this.queueBounce(c, other === a);
      }
    }
  }

  /**
   * Suspension would soak up a plain "bouncy material", so bounce ink actively
   * relaunches the whole vehicle along the pad's normal: at least as fast as you
   * hit it, and never less than a satisfying minimum.
   */
  private queueBounce(c: Contact, inkIsA: boolean) {
    if (this.bounceCooldown > 0 || this.pendingBounce) return;
    const wm = c.getWorldManifold(null);
    if (!wm) return;
    // Manifold normal points from A to B; we want it pointing away from the ink.
    let nx = wm.normal.x, ny = wm.normal.y;
    if (!inkIsA) {
      nx = -nx;
      ny = -ny;
    }
    const v = this.chassis.getLinearVelocity();
    const incoming = -(v.x * nx + v.y * ny);
    this.pendingBounce = { nx, ny, speed: Math.max(incoming * INKS.bounce.restitution, BOUNCE_MIN_SPEED) };
  }

  private applyBounce() {
    const b = this.pendingBounce;
    if (!b) return;
    this.pendingBounce = null;
    this.bounceCooldown = 0.3;
    for (const body of [this.chassis, ...this.wheels]) {
      const v = body.getLinearVelocity();
      const along = v.x * b.nx + v.y * b.ny;
      if (along < b.speed) body.setLinearVelocity(new Vec2(v.x + b.nx * (b.speed - along), v.y + b.ny * (b.speed - along)));
    }
    this.onBounce?.();
  }

  private preSolve(c: Contact) {
    const fa = c.getFixtureA(), fb = c.getFixtureB();
    const a = tag(fa), b = tag(fb);
    const aInk = a?.type === 'ink', bInk = b?.type === 'ink';
    if (!aInk && !bInk) return;

    // Ink is one-way, like a classic platform: solid from above, passable from
    // below. A stroke drawn across your path at head height can't trap you.
    const wm = c.getWorldManifold(null);
    if (wm) {
      const ny = aInk ? wm.normal.y : -wm.normal.y; // normal pointing from ink to vehicle
      if (ny < -ONE_WAY_COS) {
        c.setEnabled(false);
        return;
      }
    }

    // Boost ink: the surface itself moves, carrying you forward.
    const boostA = aInk && (a as { kind: InkKind }).kind === 'boost';
    const boostB = bInk && (b as { kind: InkKind }).kind === 'boost';
    if (!boostA && !boostB) return;
    // Box2D's tangent is perpendicular to the A→B normal; flip the sign for B.
    c.setTangentSpeed(boostA ? INKS.boost.tangentSpeed : -INKS.boost.tangentSpeed);
  }

  // ─── world content ──────────────────────────────────────────────────────

  addPlatform(p: Platform) {
    const pts = p.points;
    // Short walls at each end so you can slam into a cliff face, not tunnel through.
    const verts = [
      new Vec2(pts[0].x, pts[0].y - 3),
      ...pts.map((v) => new Vec2(v.x, v.y)),
      new Vec2(pts[pts.length - 1].x, pts[pts.length - 1].y - 3),
    ];
    const body = this.world.createBody({ type: 'static' });
    body.createFixture({ shape: new Chain(verts, false), friction: 0.9, userData: { type: 'platform' } satisfies Tag });
    this.platforms.set(p.id, body);
  }

  removePlatform(id: number) {
    const b = this.platforms.get(id);
    if (b) this.world.destroyBody(b);
    this.platforms.delete(id);
  }

  /** Create or replace a stroke's collision chain. */
  setStroke(id: number, points: readonly Vec[], kind: InkKind) {
    this.removeStroke(id);
    if (points.length < 2) return;
    const ordered = forwardOrder(points);
    const verts: Vec2[] = [];
    for (const p of ordered) {
      const last = verts[verts.length - 1];
      // Box2D rejects near-duplicate chain vertices.
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.02) verts.push(new Vec2(p.x, p.y));
    }
    if (verts.length < 2) return;
    const ink = INKS[kind];
    const body = this.world.createBody({ type: 'static' });
    body.createFixture({
      shape: new Chain(verts, false),
      friction: ink.friction,
      restitution: ink.restitution,
      userData: { type: 'ink', kind } satisfies Tag,
    });
    this.strokes.set(id, body);
  }

  removeStroke(id: number) {
    const b = this.strokes.get(id);
    if (b) this.world.destroyBody(b);
    this.strokes.delete(id);
  }

  // ─── simulation ─────────────────────────────────────────────────────────

  get grounded() {
    return this.wheelContacts[0] + this.wheelContacts[1] > 0;
  }

  get isCrashed() {
    return this.crashed;
  }

  step(dt: number, controls: Controls, updrafts: readonly Updraft[] = []) {
    const { spec } = this;
    const forwardSpeed = this.chassis.getLinearVelocity().x;
    // Wheelie control: ease off the motor when the nose climbs too far on the ground.
    const nose = this.chassis.getAngle();
    const traction = this.grounded ? clamp(1 - (nose - 0.35) * 2, 0.15, 1) : 1;
    for (const j of this.joints) {
      if (controls.throttle > 0) {
        j.setMaxMotorTorque(spec.motor.torque * traction);
        j.setMotorSpeed(-spec.motor.maxSpeed * controls.throttle);
      } else if (controls.throttle < 0) {
        // Brake while rolling forward; reverse once nearly stopped.
        j.setMaxMotorTorque(spec.motor.torque * 1.5);
        j.setMotorSpeed(forwardSpeed > 1 ? 0 : spec.motor.maxSpeed * 0.4);
      } else {
        // Coast with a little rolling resistance.
        j.setMaxMotorTorque(spec.motor.torque * 0.04);
        j.setMotorSpeed(0);
      }
    }

    const mass = this.chassis.getMass() + this.wheels.reduce((s, w) => s + w.getMass(), 0);
    if (controls.lean) {
      const k = this.grounded ? spec.tilt.ground : spec.tilt.air;
      this.chassis.applyTorque(controls.lean * k * mass, true);
    }

    this.hopCooldown = Math.max(0, this.hopCooldown - dt);
    if (controls.hop && this.grounded && this.hopCooldown === 0) {
      const up = this.chassis.getWorldVector(new Vec2(0, 1));
      this.chassis.applyLinearImpulse(new Vec2(up.x * spec.hop * mass * 0.5, up.y * spec.hop * mass), this.chassis.getWorldCenter(), true);
      this.hopCooldown = 0.6;
    }

    const pos = this.chassis.getPosition();
    for (const u of updrafts) {
      if (pos.x > u.x0 && pos.x < u.x1 && pos.y > u.y0 && pos.y < u.y1) {
        this.chassis.applyForceToCenter(new Vec2(0, u.strength * mass), true);
      }
    }

    this.bounceCooldown = Math.max(0, this.bounceCooldown - dt);
    this.world.step(dt, 8, 3);
    // A head touching ground is only a crash when you're actually tipped over —
    // brushing a line while jumping up through it (or nudging a cliff face) isn't.
    if (this.headContacts > 0 && Math.cos(this.chassis.getAngle()) < CRASH_COS) this.crashed = true;
    this.applyBounce();
  }

  state(): VehicleState {
    const p = this.chassis.getPosition();
    const v = this.chassis.getLinearVelocity();
    const surface = this.surfaces[0] ?? this.surfaces[1] ?? null;
    return {
      x: p.x,
      y: p.y,
      angle: this.chassis.getAngle(),
      vx: v.x,
      vy: v.y,
      wheels: this.wheels.map((w) => ({ x: w.getPosition().x, y: w.getPosition().y, angle: w.getAngle() })),
      grounded: this.grounded,
      surface,
      crashed: this.crashed,
    };
  }
}
