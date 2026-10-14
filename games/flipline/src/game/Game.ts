import { sfx } from '../audio/sfx';
import { heldKeys, heldPointers } from '../lib/held';
import { clamp, damp, type Vec } from '../lib/math';
import { STEP, type BikeSkin } from './config';
import { FlipTracker, type Landing } from './flips';
import { buildLevel, type BuiltLevel, type LevelDef } from './levels';
import { Physics, type BikeState } from './physics';
import { Renderer } from './render';
import { GEM_RADIUS, carefulRider, placeGemsOnRideLine } from './sim';

export type RideState = 'ready' | 'riding' | 'crashed' | 'finished' | 'paused';
export type HintId = 'ride' | 'flip' | 'land';

export interface RideHud {
  state: RideState;
  /** 0..1 along the level. */
  progress: number;
  flips: number;
  gems: number;
  gemTotal: number;
  time: number;
  /** Waiting for a fresh press after a crash. */
  canRetry: boolean;
}

export interface RideResult {
  levelId: number;
  time: number;
  flips: number;
  perfects: number;
  gems: number[];
  crashes: number;
}

export type RideEvent =
  | { type: 'landing'; landing: Landing }
  | { type: 'gem'; index: number }
  | { type: 'checkpoint'; index: number }
  | { type: 'crash' }
  | { type: 'respawn' }
  | { type: 'hint'; id: HintId; text: string }
  | { type: 'hint-done'; id: HintId }
  | { type: 'finish'; result: RideResult };

export interface GameOptions {
  level: LevelDef;
  skin: BikeSkin;
  reducedMotion?: boolean;
  /** Title-screen showcase: rides itself, loops forever, no input. */
  attract?: boolean;
  tutorial?: boolean;
  onHud?: (h: RideHud) => void;
  onEvent?: (e: RideEvent) => void;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  shake: number;
}

/** Keys that never count as "hold" (they have their own jobs). */
const RESERVED = new Set(['Escape', 'KeyR', 'Tab', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'F5', 'F12']);

const built = new Map<number, BuiltLevel>();
/** Geometry + gem placement are deterministic: build once per level. */
export function levelGeometry(def: LevelDef): BuiltLevel {
  let b = built.get(def.id);
  if (!b) {
    b = placeGemsOnRideLine(buildLevel(def.pieces));
    built.set(def.id, b);
  }
  return b;
}

/** One ride of one level. React sees HUD snapshots and events only. */
export class Game {
  readonly level: BuiltLevel;
  readonly def: LevelDef;
  readonly physics: Physics;
  readonly camera: Camera = { x: 0, y: 2, zoom: 1, shake: 0 };
  readonly collected = new Set<number>();
  state: RideState = 'ready';
  checkpoint = 0;
  flips = 0;
  perfects = 0;
  crashes = 0;
  time = 0;
  /** Seconds since the game was created (animations). */
  clock = 0;
  bike: BikeState;
  airTurns = 0;

  private renderer: Renderer;
  private flipper = new FlipTracker();
  private holdKeys = new Set<string>();
  private holdPointers = new Set<number>();
  private needsRelease = false;
  private retryQueued = false;
  private acc = 0;
  private crashTimer = 0;
  private finishTimer = 0;
  private raf = 0;
  private last = 0;
  private hudTimer = 0;
  private destroyed = false;
  private unbind: (() => void)[] = [];
  private hints = new Set<HintId>();
  private activeHint: HintId | null = null;
  private airTime = 0;
  private trailTimer = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: GameOptions,
  ) {
    this.def = opts.level;
    this.level = levelGeometry(opts.level);
    this.physics = new Physics(this.level, this.level.checkpoints[0]);
    this.bike = this.physics.state();
    this.camera.x = this.bike.x + 6;
    this.camera.y = this.bike.y + 1;
    this.renderer = new Renderer(canvas, { reducedMotion: !!opts.reducedMotion, color: opts.level.color, glow: opts.level.glow, skin: opts.skin });
    if (opts.attract) {
      this.state = 'riding';
      // Ride along the bottom of the title screen, clear of the menu.
      this.renderer.anchorY = 0.86;
    }
    else {
      this.bindInput();
      if (opts.tutorial) this.hint('ride', 'Hold to ride');
      // Already holding (tapped Play and kept holding through the transition)? Ride now.
      for (const code of heldKeys) if (!RESERVED.has(code)) this.holdKeys.add(`k:${code}`);
      for (const id of heldPointers) this.holdPointers.add(id);
    }
    const onResize = () => this.renderer.resize();
    window.addEventListener('resize', onResize);
    this.unbind.push(() => window.removeEventListener('resize', onResize));
  }

  // ─── lifecycle ──────────────────────────────────────────────────────────

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    if (this.state !== 'riding' && this.state !== 'ready') return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.holdKeys.clear();
    this.holdPointers.clear();
    sfx.engine(0, false);
    this.emitHud();
  }
  private pausedFrom: RideState = 'ready';

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom;
    this.last = performance.now();
    this.emitHud();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbind.forEach((u) => u());
    sfx.engine(0, false);
  }

  get holding(): boolean {
    return this.holdKeys.size > 0 || this.holdPointers.size > 0;
  }

  // ─── input: one button, any way you like ───────────────────────────────

  private bindInput() {
    const c = this.canvas;
    const down = (e: KeyboardEvent) => {
      if (RESERVED.has(e.code) || e.metaKey || e.ctrlKey) return;
      if ((e.target as HTMLElement)?.closest?.('button, a, input')) return;
      e.preventDefault();
      if (!e.repeat) this.press(`k:${e.code}`);
    };
    const up = (e: KeyboardEvent) => this.release(`k:${e.code}`);
    const pdown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.press(`p:${e.pointerId}`);
    };
    const pup = (e: PointerEvent) => this.release(`p:${e.pointerId}`);
    const blur = () => {
      this.holdKeys.clear();
      this.holdPointers.clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    c.addEventListener('pointerdown', pdown);
    window.addEventListener('pointerup', pup);
    window.addEventListener('pointercancel', pup);
    window.addEventListener('blur', blur);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this.unbind.push(
      () => window.removeEventListener('keydown', down),
      () => window.removeEventListener('keyup', up),
      () => c.removeEventListener('pointerdown', pdown),
      () => window.removeEventListener('pointerup', pup),
      () => window.removeEventListener('pointercancel', pup),
      () => window.removeEventListener('blur', blur),
    );
  }

  /** Public so on-screen controls and tests can drive the button. */
  press(id: string) {
    sfx.ensure();
    if (id.startsWith('k:')) this.holdKeys.add(id);
    else this.holdPointers.add(Number(id.slice(2)));
    if (this.state === 'crashed' && !this.needsRelease) {
      // A fresh press retries — immediately, or as soon as the crash slow-mo ends.
      if (this.crashTimer <= 0) this.respawn();
      else this.retryQueued = true;
    }
  }

  release(id: string) {
    if (id.startsWith('k:')) this.holdKeys.delete(id);
    else this.holdPointers.delete(Number(id.slice(2)));
    if (!this.holding) this.needsRelease = false;
  }

  // ─── simulation ─────────────────────────────────────────────────────────

  private frame(dt: number) {
    this.clock += dt;
    if (this.state === 'riding' || this.state === 'ready' || this.state === 'crashed' || this.state === 'finished') {
      const slow = this.state === 'crashed' ? 0.25 : 1;
      this.acc += dt * slow;
      let n = 0;
      while (this.acc >= STEP && n < 5) {
        this.acc -= STEP;
        this.step(STEP);
        n++;
      }
    }
    if (this.state === 'crashed' && this.crashTimer > 0) {
      this.crashTimer -= dt;
      if (this.crashTimer <= 0 && this.retryQueued) this.respawn();
    }
    if (this.state === 'finished') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0 && this.finishTimer > -100) {
        this.finishTimer = -1000;
        this.opts.onEvent?.({ type: 'finish', result: this.result() });
      }
    }
    this.updateCamera(dt);
    this.renderer.draw(this, dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) this.emitHud();
  }

  private input(): boolean {
    if (this.opts.attract) return this.autopilot();
    if (this.state === 'finished' || this.state === 'crashed') return false;
    return this.holding;
  }

  private step(dt: number) {
    const hold = this.input();
    if (this.state === 'ready') {
      if (!hold) {
        // Waiting at the start / checkpoint: keep the bike settled.
        this.physics.step(dt, false);
        this.bike = this.physics.state();
        return;
      }
      this.state = 'riding';
      this.doneHint('ride');
    }
    const prev = this.bike;
    this.physics.step(dt, this.state === 'riding' ? hold : false);
    this.bike = this.physics.state();
    const s = this.bike;
    if (this.state !== 'riding') return;

    this.time += dt;
    if (!s.grounded) this.airTime += dt;
    else this.airTime = 0;

    // Tutorial: first time in the air.
    if (this.opts.tutorial && this.airTime > 0.25 && !this.hints.has('flip')) this.hint('flip', 'Hold in the air to flip backwards');

    const landing = this.flipper.update(dt, s.angle, s.grounded, s.normal);
    this.airTurns = this.flipper.airborne ? this.flipper.turns : 0;
    if (landing) this.onLanding(landing, prev);

    // Sparks and engine.
    if (s.grounded && hold && s.speed > 3) {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.03;
        const w = s.wheels[0];
        this.renderer.particles.burst(w.x, w.y - 0.4, { count: 1, color: this.def.color, speed: 3, life: 0.4, angle: Math.PI * 0.85, spread: 0.7 });
      }
    }
    if (!this.opts.attract) sfx.engine(clamp(s.speed / 24, 0, 1), hold && s.grounded, !s.grounded && hold);

    // Checkpoints.
    const cps = this.level.checkpoints;
    while (this.checkpoint + 1 < cps.length && s.x >= cps[this.checkpoint + 1].x) {
      this.checkpoint++;
      if (!this.opts.attract) sfx.checkpoint();
      this.opts.onEvent?.({ type: 'checkpoint', index: this.checkpoint });
    }

    // Gems.
    this.level.gems.forEach((g, i) => {
      if (this.collected.has(i) || Math.abs(g.x - s.x) > 3) return;
      if (Math.hypot(g.x - s.x, g.y - s.y) < GEM_RADIUS) {
        this.collected.add(i);
        if (!this.opts.attract) sfx.gem(this.collected.size);
        this.renderer.particles.burst(g.x, g.y, { count: 18, color: '#ffffff', speed: 6, life: 0.6 });
        this.opts.onEvent?.({ type: 'gem', index: i });
      }
    });

    if (s.crashed || s.y < this.level.floor - 15) this.crash();
    else if (s.x >= this.level.finishX) this.finish();
  }

  private onLanding(l: Landing, prev: BikeState) {
    const impact = Math.abs(prev.vy);
    if (impact > 9) this.camera.shake = Math.min(1, this.camera.shake + impact / 40);
    if (l.flips > 0) {
      this.flips += l.flips;
      if (l.quality === 'perfect') this.perfects++;
      this.physics.boost(l.boost);
      this.doneHint('flip');
      if (this.opts.tutorial && !this.hints.has('land')) this.hint('land', 'Release to stop spinning — land on your wheels');
      else this.doneHint('land');
      if (!this.opts.attract) sfx.landTrick(l.flips, l.quality === 'perfect');
      const s = this.bike;
      this.renderer.particles.burst(s.x, s.y - 0.5, { count: 20 + l.flips * 10, color: this.def.color, speed: 9, life: 0.7 });
      if (l.quality === 'perfect') this.renderer.ring(s.x, s.y, '#ffffff');
    } else if (impact > 6 && !this.opts.attract) {
      sfx.land(Math.min(1, impact / 20));
    }
    this.opts.onEvent?.({ type: 'landing', landing: l });
  }

  private crash() {
    this.state = 'crashed';
    this.crashes++;
    this.crashTimer = 0.9;
    this.needsRelease = this.holding; // a fresh press retries — not the one you crashed holding
    this.camera.shake = 1;
    this.flipper.reset();
    const s = this.bike;
    this.renderer.particles.burst(s.x, s.y, { count: 50, color: this.def.color, speed: 11, life: 1 });
    this.renderer.particles.burst(s.x, s.y + 0.8, { count: 20, color: '#ffffff', speed: 7, life: 0.8 });
    this.renderer.flash = 1;
    if (this.opts.attract) {
      this.crashTimer = 0.6;
      setTimeout(() => !this.destroyed && this.respawn(), 900);
      return;
    }
    sfx.engine(0, false);
    sfx.crash();
    if (this.opts.tutorial && !this.hints.has('land')) this.hint('land', 'Release to stop spinning — land on your wheels');
    this.opts.onEvent?.({ type: 'crash' });
    this.emitHud();
  }

  respawn() {
    this.retryQueued = false;
    const cp = this.level.checkpoints[this.checkpoint];
    this.physics.spawn(cp);
    this.bike = this.physics.state();
    this.flipper.reset();
    this.airTime = 0;
    this.state = this.opts.attract ? 'riding' : 'ready';
    this.renderer.clearTrail();
    this.opts.onEvent?.({ type: 'respawn' });
    this.emitHud();
  }

  /** Start the level over from the very beginning. */
  restart() {
    this.checkpoint = 0;
    this.collected.clear();
    this.flips = this.perfects = this.crashes = 0;
    this.time = 0;
    this.respawn();
  }

  private finish() {
    this.state = 'finished';
    this.finishTimer = 1.3;
    sfx.engine(0, false);
    if (this.opts.attract) {
      setTimeout(() => !this.destroyed && this.restart(), 1500);
      return;
    }
    sfx.finish();
    for (let i = 0; i < 4; i++) {
      this.renderer.particles.burst(this.level.finishX, this.bike.y + 2 + i, { count: 30, color: i % 2 ? '#ffffff' : this.def.color, speed: 10, life: 1.2 });
    }
    this.emitHud();
  }

  result(): RideResult {
    return {
      levelId: this.def.id,
      time: Math.round(this.time * 100) / 100,
      flips: this.flips,
      perfects: this.perfects,
      gems: [...this.collected].sort(),
      crashes: this.crashes,
    };
  }

  // ─── tutorial ───────────────────────────────────────────────────────────

  private hint(id: HintId, text: string) {
    if (this.hints.has(id)) return;
    this.hints.add(id);
    this.activeHint = id;
    this.opts.onEvent?.({ type: 'hint', id, text });
  }

  private doneHint(id: HintId) {
    if (this.activeHint !== id) return;
    this.activeHint = null;
    this.opts.onEvent?.({ type: 'hint-done', id });
  }

  // ─── autopilot (title screen) ───────────────────────────────────────────

  private flipPlan = 0;
  private spun = 0;
  private lastAngle: number | null = null;

  /** Rides carefully but throws a backflip on bigger jumps — a showcase. */
  private autopilot(): boolean {
    const s = this.bike;
    if (s.grounded) {
      this.spun = 0;
      this.lastAngle = null;
      this.flipPlan = 0;
      return true;
    }
    if (this.lastAngle != null) this.spun += Math.atan2(Math.sin(s.angle - this.lastAngle), Math.cos(s.angle - this.lastAngle));
    this.lastAngle = s.angle;
    if (this.flipPlan === 0) this.flipPlan = s.vy > 6 ? 1 : -1;
    if (this.flipPlan === 1) return this.spun < Math.PI * 2 - 0.9;
    return carefulRider(s);
  }

  // ─── camera & hud ───────────────────────────────────────────────────────

  private updateCamera(dt: number) {
    const s = this.bike;
    const c = this.camera;
    const air = s.grounded ? 0 : 1;
    c.zoom = damp(c.zoom, 1 - clamp(s.speed / 70, 0, 0.18) - air * 0.08, 2, dt);
    const ahead = this.renderer.metersAcross(c) * 0.14 + clamp(s.vx * 0.25, -2, 6);
    c.x = damp(c.x, s.x + ahead, 5, dt);
    c.y = damp(c.y, s.y + 1, 3.5, dt);
    c.shake = Math.max(0, c.shake - dt * 2.4) * (this.opts.reducedMotion ? 0 : 1);
  }

  private emitHud() {
    this.hudTimer = 0.066;
    const cps = this.level.checkpoints;
    this.opts.onHud?.({
      state: this.state,
      progress: clamp((this.bike.x - cps[0].x) / (this.level.finishX - cps[0].x), 0, 1),
      flips: this.flips,
      gems: this.collected.size,
      gemTotal: this.level.gems.length,
      time: this.time,
      canRetry: this.state === 'crashed' && this.crashTimer <= 0,
    });
  }

  worldToScreen(p: Vec) {
    return this.renderer.worldToScreen(p, this.camera);
  }
}
