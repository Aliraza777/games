import { Box, Chain, Circle, Vec2, WheelJoint, World, type Body, type Contact, type Fixture } from 'planck';
import { angleDelta, damp, type Vec } from '../lib/math';
import { BIKE, GRAVITY } from './config';
import type { BuiltLevel, LoopDef } from './levels';

type Tag =
  | { type: 'track' }
  | { type: 'loop'; id: number }
  | { type: 'wheel'; index: number }
  | { type: 'head' }
  | { type: 'bike' };

const tag = (f: Fixture) => f.getUserData() as Tag | undefined;
const isTrack = (t?: Tag) => t?.type === 'track' || t?.type === 'loop';

interface LoopState extends LoopDef {
  /** Angle travelled round the centre (rad, CCW positive). */
  progress: number;
  last: number | null;
  /** Lap complete: the loop stops colliding so you roll out instead of looping forever. */
  done: boolean;
}

export interface BikeState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  speed: number;
  wheels: { x: number; y: number; angle: number }[];
  grounded: boolean;
  /** Track normal under the wheels (for landing judgement). */
  normal: Vec;
  crashed: boolean;
}

/** One level's world: the bike, its track lines and its loops. */
export class Physics {
  readonly world: World;
  chassis!: Body;
  wheels!: Body[];
  private joints!: WheelJoint[];
  private wheelContacts = [0, 0];
  private headContacts = 0;
  /** Helmet overlaps per loop — only a crash if the helmet is *inside* that loop. */
  private headLoops = new Map<number, number>();
  private normal: Vec = { x: 0, y: 1 };
  private crashed = false;
  readonly loops: LoopState[];

  constructor(level: BuiltLevel, spawn: Vec) {
    this.world = new World({ gravity: new Vec2(0, GRAVITY) });
    for (const line of level.lines) {
      if (line.length < 2) continue;
      const body = this.world.createBody({ type: 'static' });
      body.createFixture({
        shape: new Chain(line.map((p) => new Vec2(p.x, p.y)), false),
        friction: 1,
        userData: { type: 'track' } satisfies Tag,
      });
    }
    this.loops = level.loops.map((l) => ({ ...l, progress: 0, last: null, done: false }));
    for (const l of this.loops) {
      const n = 56;
      const pts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return new Vec2(l.cx + Math.cos(a) * l.r, l.cy + Math.sin(a) * l.r);
      });
      const body = this.world.createBody({ type: 'static' });
      body.createFixture({ shape: new Chain(pts, true), friction: 1, userData: { type: 'loop', id: l.id } satisfies Tag });
    }
    this.world.on('begin-contact', (c) => this.contact(c, 1));
    this.world.on('end-contact', (c) => this.contact(c, -1));
    this.world.on('pre-solve', (c) => this.preSolve(c));
    this.spawn(spawn);
  }

  /** (Re)create the bike at a checkpoint, at rest. */
  spawn(at: Vec) {
    if (this.chassis) {
      this.world.destroyBody(this.chassis);
      for (const w of this.wheels) this.world.destroyBody(w);
    }
    this.wheelContacts = [0, 0];
    this.headContacts = 0;
    this.headLoops.clear();
    this.crashed = false;
    for (const l of this.loops) Object.assign(l, { progress: 0, last: null, done: false });

    const { chassis: c, wheel: w, torso, head } = BIKE;
    const y = at.y - w.y + w.r + 0.05;
    this.chassis = this.world.createBody({ type: 'dynamic', position: new Vec2(at.x, y), angularDamping: 0.4 });
    this.chassis.createFixture({ shape: new Box(c.w / 2, c.h / 2), density: c.density, friction: 0.4, userData: { type: 'bike' } satisfies Tag });
    this.chassis.createFixture({
      shape: new Box(torso.hw, torso.hh, new Vec2(torso.x, torso.y), 0),
      density: torso.density,
      friction: 0.4,
      userData: { type: 'bike' } satisfies Tag,
    });
    this.chassis.createFixture({ shape: new Circle(new Vec2(head.x, head.y), head.r), isSensor: true, userData: { type: 'head' } satisfies Tag });

    this.wheels = w.x.map((wx, index) => {
      const b = this.world.createBody({ type: 'dynamic', position: new Vec2(at.x + wx, y + w.y) });
      b.createFixture({ shape: new Circle(w.r), density: w.density, friction: w.friction, userData: { type: 'wheel', index } satisfies Tag });
      return b;
    });
    this.joints = this.wheels.map(
      (wheel, i) =>
        this.world.createJoint(
          new WheelJoint(
            {
              enableMotor: i === 0, // rear-wheel drive
              motorSpeed: 0,
              maxMotorTorque: BIKE.motor.torque,
              frequencyHz: BIKE.suspension.hz,
              dampingRatio: BIKE.suspension.damping,
            },
            this.chassis,
            wheel,
            wheel.getPosition(),
            new Vec2(0, 1),
          ),
        )!,
    ) as WheelJoint[];
  }

  private contact(c: Contact, d: 1 | -1) {
    const a = tag(c.getFixtureA()), b = tag(c.getFixtureB());
    for (const [self, other] of [
      [a, b],
      [b, a],
    ] as const) {
      if (!isTrack(other)) continue;
      if (self?.type === 'wheel') this.wheelContacts[self.index] = Math.max(0, this.wheelContacts[self.index] + d);
      if (self?.type === 'head') {
        if (other?.type === 'loop') this.headLoops.set(other.id, Math.max(0, (this.headLoops.get(other.id) ?? 0) + d));
        else this.headContacts = Math.max(0, this.headContacts + d);
      }
    }
  }

  /**
   * Loops are one-sided: they only collide when the bike is inside them, and
   * not at all once the lap is complete. Also records the ground normal.
   */
  private preSolve(c: Contact) {
    const fa = c.getFixtureA(), fb = c.getFixtureB();
    const a = tag(fa), b = tag(fb);
    const loopTag = a?.type === 'loop' ? a : b?.type === 'loop' ? b : null;
    const wm = c.getWorldManifold(null);
    if (loopTag) {
      const loop = this.loops[loopTag.id];
      if (loop.done || !wm) {
        c.setEnabled(false);
        return;
      }
      const p = wm.points[0] ?? { x: loop.cx, y: loop.cy - loop.r };
      // Normal from loop to bike; inside the loop it points towards the centre.
      const nx = a?.type === 'loop' ? wm.normal.x : -wm.normal.x;
      const ny = a?.type === 'loop' ? wm.normal.y : -wm.normal.y;
      if (nx * (loop.cx - p.x) + ny * (loop.cy - p.y) <= 0) {
        c.setEnabled(false);
        return;
      }
    }
    const wheel = a?.type === 'wheel' ? 'a' : b?.type === 'wheel' ? 'b' : null;
    if (wheel && wm && (isTrack(a) || isTrack(b))) {
      this.normal = wheel === 'b' ? { x: wm.normal.x, y: wm.normal.y } : { x: -wm.normal.x, y: -wm.normal.y };
    }
  }

  get grounded() {
    return this.wheelContacts[0] + this.wheelContacts[1] > 0;
  }

  step(dt: number, hold: boolean) {
    const rear = this.joints[0];
    if (this.grounded) {
      rear.enableMotor(true);
      if (hold) {
        rear.setMaxMotorTorque(BIKE.motor.torque);
        rear.setMotorSpeed(-BIKE.motor.maxSpeed);
      } else {
        // Coast: a touch of drag, no brake.
        rear.setMaxMotorTorque(BIKE.motor.torque * 0.05);
        rear.setMotorSpeed(0);
      }
    } else {
      rear.enableMotor(false);
      // Air control: holding spins the whole bike backwards at a fixed, learnable
      // rate. Wheels move with the frame as one rigid body so flips stay crisp.
      const w = this.chassis.getAngularVelocity();
      const target = hold ? BIKE.flipSpeed : 0;
      const k = hold ? BIKE.flipResponse : BIKE.releaseDamping;
      const omega = damp(w, target, k, dt);
      this.chassis.setAngularVelocity(omega);
      const c = this.chassis.getWorldCenter();
      const vc = this.chassis.getLinearVelocity();
      for (const wheel of this.wheels) {
        const r = wheel.getWorldCenter();
        wheel.setLinearVelocity(new Vec2(vc.x - omega * (r.y - c.y), vc.y + omega * (r.x - c.x)));
      }
    }

    this.world.step(dt, 8, 3);
    this.trackLoops();
    // Helmet on the track = crash (any angle — that's the deal in this genre).
    if (this.headContacts > 0) this.crashed = true;
    // Loops: brushing the outside on the way in is fine; hitting the inside means you fell.
    for (const [id, n] of this.headLoops) {
      const l = this.loops[id];
      // Ignore the helmet passing through the loop's side on the way in; once you're
      // riding it (some lap progress), a helmet on the loop means you fell.
      if (n <= 0 || l.done || l.progress < 0.6) continue;
      const h = this.chassis.getWorldPoint(new Vec2(BIKE.head.x, BIKE.head.y));
      if (Math.hypot(h.x - l.cx, h.y - l.cy) < l.r - BIKE.head.r * 0.5) this.crashed = true;
    }
  }

  private trackLoops() {
    const p = this.chassis.getPosition();
    for (const l of this.loops) {
      const dx = p.x - l.cx, dy = p.y - l.cy;
      const dist = Math.hypot(dx, dy);
      const near = Math.abs(dx) < l.r + 6 && dy < l.r + 3;
      if (!near) {
        if (l.progress !== 0 || l.done) Object.assign(l, { progress: 0, last: null, done: false });
        continue;
      }
      if (l.done) continue;
      const ang = Math.atan2(dy, dx);
      if (dist < l.r && l.last != null) l.progress += angleDelta(l.last, ang);
      l.last = dist < l.r ? ang : null;
      // Most of a lap done and coming back down the left side: let go of the loop.
      if (l.progress > Math.PI * 1.6 && dx < 0) l.done = true;
    }
  }

  /** Instant speed burst along the bike's forward direction (flip reward). */
  boost(amount: number) {
    if (amount <= 0) return;
    const f = this.chassis.getWorldVector(new Vec2(1, 0));
    for (const body of [this.chassis, ...this.wheels]) {
      const v = body.getLinearVelocity();
      body.setLinearVelocity(new Vec2(v.x + f.x * amount, v.y + f.y * amount));
    }
  }

  state(): BikeState {
    const p = this.chassis.getPosition();
    const v = this.chassis.getLinearVelocity();
    return {
      x: p.x,
      y: p.y,
      angle: this.chassis.getAngle(),
      vx: v.x,
      vy: v.y,
      speed: Math.hypot(v.x, v.y),
      wheels: this.wheels.map((w) => ({ x: w.getPosition().x, y: w.getPosition().y, angle: w.getAngle() })),
      grounded: this.grounded,
      normal: { ...this.normal },
      crashed: this.crashed,
    };
  }
}

