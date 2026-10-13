import { heldKeys } from '../lib/heldKeys';
import { clamp, damp, dist, type Vec } from '../lib/math';
import { sfx } from '../audio/sfx';
import {
  FOCUS,
  INKS,
  INK_ORDER,
  MAX_STROKES,
  SCORE,
  TANK,
  VEHICLES,
  type InkKind,
  type VehicleId,
  type VehicleSpec,
} from './config';
import { InkTank, StrokeBuilder, cycleInk, distToStroke, strokeCost } from './ink';
import { Physics, type Controls, type VehicleState } from './physics';
import { Renderer, type Camera } from './render';
import { TrickTracker, type TrickLanding } from './tricks';
import { Course, type Gap, type Pickup, type Platform, type Updraft } from './worldgen';

const STEP = 1 / 60;
const DRIVE_KEYS = new Set(['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);
const START_X = 6;

export type HintId = 'drive' | 'draw' | 'inks' | 'flip' | 'cliff' | 'empty' | 'stuck';

export interface HudState {
  distance: number;
  score: number;
  ink: number;
  inkKind: InkKind;
  focus: number;
  focusActive: boolean;
  stars: number;
  combo: number;
  speedKmh: number;
  state: GameState;
}

export type GameEvent =
  | { type: 'trick'; landing: TrickLanding }
  | { type: 'pickup'; kind: Pickup['kind'] }
  | { type: 'hint'; id: HintId; text: string }
  | { type: 'hint-done'; id: HintId }
  | { type: 'started' };

export interface RunResult {
  vehicle: VehicleId;
  seed: number;
  daily: boolean;
  distance: number;
  score: number;
  stars: number;
  flips: number;
  bestTrick: string | null;
  inkDrawn: number;
  cause: 'void' | 'crash';
  seconds: number;
}

export type GameState = 'ready' | 'running' | 'paused' | 'crashing' | 'over';

export interface GameOptions {
  vehicle: VehicleId;
  seed: number;
  daily?: boolean;
  /** Attract mode: autopilot, unlimited ink, no input, restarts forever. */
  attract?: boolean;
  reducedMotion?: boolean;
  shake?: number;
  tutorial?: boolean;
  onHud?: (h: HudState) => void;
  onEvent?: (e: GameEvent) => void;
  onOver?: (r: RunResult) => void;
}

export interface Stroke {
  id: number;
  kind: InkKind;
  points: Vec[];
  maxX: number;
  born: number;
}

const HINTS: Record<HintId, string> = {
  drive: 'Hold W or ↑ to drive',
  draw: 'Gap ahead! Hold the mouse and drag across it to draw a bridge',
  inks: 'Press 2 for bouncy ink, 3 for boost ink (or scroll)',
  flip: 'Lean with A / D in the air — flips refill your ink',
  cliff: 'Cliff! Draw a ramp up to it. Hold Shift to slow time',
  empty: 'Out of ink — grab ink drops and land flips to refill',
  stuck: 'Stuck? Right-click a line to erase it, hop with Space, or press R to restart',
};

/**
 * One run of Inkway: physics, streaming world, drawing, tricks, camera and
 * rendering. React only sees HUD snapshots and events.
 */
export class Game {
  readonly spec: VehicleSpec;
  state: GameState = 'ready';
  readonly physics: Physics;
  readonly course: Course;
  readonly tank = new InkTank();
  readonly camera: Camera = { x: START_X + 6, y: 2, zoom: 1, shake: 0 };
  readonly platforms: Platform[] = [];
  readonly gaps: Gap[] = [];
  readonly pickups: (Pickup & { taken: boolean })[] = [];
  readonly updrafts: Updraft[] = [];
  readonly strokes = new Map<number, Stroke>();
  inkKind: InkKind = 'road';
  focus = FOCUS.max;
  distance = 0;
  stars = 0;
  trickPoints = 0;
  flips = 0;
  inkDrawn = 0;
  time = 0;

  private renderer: Renderer;
  private tricks = new TrickTracker();
  private keys = new Set<string>();
  private mouse = { x: -1, y: -1, inside: false, drawing: false };
  private builder: { id: number; b: StrokeBuilder } | null = null;
  private strokeDirty = false;
  private nextStrokeId = 1;
  private acc = 0;
  private raf = 0;
  private lastFrame = 0;
  private crashTimer = 0;
  private cause: RunResult['cause'] = 'crash';
  private hudTimer = 0;
  private bestTrick: { label: string; points: number } | null = null;
  private hints = new Set<HintId>();
  private activeHint: HintId | null = null;
  private tutorialSlow = false;
  private bridgedGaps = new Set<number>();
  private lastVehicle: VehicleState;
  private landingVy = 0;
  private unbind: (() => void)[] = [];
  private destroyed = false;
  private overSent = false;
  private stuckFor = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: GameOptions,
  ) {
    this.spec = VEHICLES[opts.vehicle];
    this.course = new Course(opts.seed);
    const lift = -this.spec.wheel.y + this.spec.wheel.r + 0.05;
    this.physics = new Physics(this.spec, { x: START_X, y: lift });
    this.physics.onBounce = () => {
      sfx.bounce();
      const s = this.physics.state();
      this.renderer.particles.burst(s.x, s.y - 0.6, { count: 18, color: INKS.bounce.color, speed: 7, life: 0.6, spread: Math.PI, angle: Math.PI / 2 });
    };
    this.renderer = new Renderer(canvas, { reducedMotion: !!opts.reducedMotion });
    this.lastVehicle = this.physics.state();
    this.streamWorld();
    this.firstGapId = this.gaps[0]?.id ?? -1;
    if (opts.attract) {
      // Frame the demo in the open lower-right of the title screen, clear of the menus.
      this.renderer.anchor = { x: 0.8, y: 0.8 };
      this.state = 'running';
      this.tank.level = TANK.max;
    } else {
      this.adoptHeldKeys();
      this.bindInput();
      if (opts.tutorial) this.hint('drive');
    }
    const onResize = () => this.renderer.resize();
    window.addEventListener('resize', onResize);
    this.unbind.push(() => window.removeEventListener('resize', onResize));
  }

  // ─── lifecycle ───────────────────────────────────────────────────────────

  start() {
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    if (this.state !== 'running' && this.state !== 'ready') return;
    this.state = 'paused';
    this.endStroke();
    this.keys.clear();
    sfx.engineStop();
    sfx.scribble(false);
    this.emitHud(true);
  }

  /** Keys already held (W through a menu transition or a pause) still count. */
  private adoptHeldKeys() {
    for (const k of heldKeys) if (DRIVE_KEYS.has(k)) this.keys.add(k);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.adoptHeldKeys();
    this.state = this.distance > 0.5 ? 'running' : 'ready';
    this.lastFrame = performance.now();
    this.emitHud(true);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbind.forEach((u) => u());
    sfx.engineStop();
    sfx.scribble(false);
  }

  setInk(kind: InkKind) {
    if (this.inkKind === kind) return;
    this.inkKind = kind;
    this.endStroke();
    sfx.inkSwitch(INK_ORDER.indexOf(kind));
    if (kind !== 'road') this.doneHint('inks');
    this.emitHud(true);
  }

  // ─── coordinates (also used by tests) ───────────────────────────────────

  worldToScreen(p: Vec): Vec {
    return this.renderer.worldToScreen(p, this.camera);
  }

  screenToWorld(p: Vec): Vec {
    return this.renderer.screenToWorld(p, this.camera);
  }

  vehicle(): VehicleState {
    return this.lastVehicle;
  }

  // ─── input ───────────────────────────────────────────────────────────────

  private bindInput() {
    const c = this.canvas;
    const keyName = (e: KeyboardEvent) => e.key.toLowerCase();
    const GAME_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', '1', '2', '3']);
    const down = (e: KeyboardEvent) => {
      const k = keyName(e);
      if (!GAME_KEYS.has(k) || e.metaKey || e.ctrlKey) return;
      if ((e.target as HTMLElement)?.closest?.('button, input')) return;
      e.preventDefault();
      if (k === '1' || k === '2' || k === '3') this.setInk(INK_ORDER[Number(k) - 1]);
      else this.keys.add(k);
    };
    const up = (e: KeyboardEvent) => this.keys.delete(keyName(e));
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.inside = true;
    };
    const pdown = (e: PointerEvent) => {
      pos(e);
      sfx.ensure();
      if (e.button === 2) {
        this.erase(this.screenToWorld(this.mouse));
        return;
      }
      if (e.button !== 0 || (this.state !== 'running' && this.state !== 'ready')) return;
      c.setPointerCapture?.(e.pointerId);
      this.mouse.drawing = true;
    };
    const pup = (e: PointerEvent) => {
      if (e.button === 0) {
        this.mouse.drawing = false;
        this.endStroke();
      }
    };
    const leave = () => (this.mouse.inside = false);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.setInk(cycleInk(this.inkKind, e.deltaY > 0 ? 1 : -1, INK_ORDER));
    };
    const menu = (e: Event) => e.preventDefault();
    const blur = () => {
      this.keys.clear();
      this.mouse.drawing = false;
      this.endStroke();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    c.addEventListener('pointermove', pos);
    c.addEventListener('pointerdown', pdown);
    window.addEventListener('pointerup', pup);
    c.addEventListener('pointerleave', leave);
    c.addEventListener('wheel', wheel, { passive: false });
    c.addEventListener('contextmenu', menu);
    window.addEventListener('blur', blur);
    this.unbind.push(
      () => window.removeEventListener('keydown', down),
      () => window.removeEventListener('keyup', up),
      () => c.removeEventListener('pointermove', pos),
      () => c.removeEventListener('pointerdown', pdown),
      () => window.removeEventListener('pointerup', pup),
      () => c.removeEventListener('pointerleave', leave),
      () => c.removeEventListener('wheel', wheel),
      () => c.removeEventListener('contextmenu', menu),
      () => window.removeEventListener('blur', blur),
    );
  }

  private controls(): Controls {
    if (this.opts.attract) return this.autopilot();
    const k = this.keys;
    const gas = k.has('w') || k.has('arrowup');
    const brake = k.has('s') || k.has('arrowdown');
    const back = k.has('a') || k.has('arrowleft');
    const fwd = k.has('d') || k.has('arrowright');
    return { throttle: gas ? 1 : brake ? -1 : 0, lean: (back ? 1 : 0) - (fwd ? 1 : 0), hop: k.has(' ') };
  }

  get focusActive() {
    return this.keys.has('shift') && this.focus > 0 && this.state === 'running';
  }

  // ─── frame ───────────────────────────────────────────────────────────────

  private frame(dt: number) {
    const live = this.state === 'running' || this.state === 'ready' || this.state === 'crashing';
    if (live) {
      const scale = this.state === 'crashing' ? 0.3 : this.focusActive ? FOCUS.timeScale : this.tutorialSlow ? 0.45 : 1;
      this.acc += dt * scale;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.acc -= STEP;
        this.step(STEP);
        steps++;
      }
      // Focus drains in real time so slow-mo can't be abused for free.
      if (this.focusActive) this.focus = Math.max(0, this.focus - FOCUS.drain * dt);
      else this.focus = Math.min(FOCUS.max, this.focus + FOCUS.regen * dt);
      this.updateDrawing();
      if (this.state === 'crashing') {
        this.crashTimer -= dt;
        if (this.crashTimer <= 0) this.finish();
      }
    }
    this.time += dt;
    this.updateCamera(dt);
    this.renderer.draw(this, dt);
    this.updateAudio();
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) this.emitHud();
  }

  private step(dt: number) {
    const ctl = this.controls();
    if (this.state === 'ready') {
      if (ctl.throttle > 0) {
        this.state = 'running';
        this.doneHint('drive');
        this.opts.onEvent?.({ type: 'started' });
      } else {
        ctl.throttle = 0;
      }
    }
    const crashing = this.state === 'crashing';
    this.physics.step(dt, crashing ? { throttle: 0, lean: 0, hop: false } : ctl, this.updrafts);
    const s = this.physics.state();
    const prev = this.lastVehicle;
    this.lastVehicle = s;
    if (crashing) return;

    this.distance = Math.max(this.distance, s.x - START_X);

    // Landing impact → sparks + shake.
    if (!prev.grounded && s.grounded) {
      const impact = Math.abs(this.landingVy);
      if (impact > 6) {
        this.camera.shake = Math.min(1, this.camera.shake + impact / 30);
        sfx.land(Math.min(1, impact / 20));
        for (const w of s.wheels) this.renderer.particles.burst(w.x, w.y - this.spec.wheel.r, { count: 6, color: '#ffffff', speed: 5, life: 0.35, spread: Math.PI, angle: Math.PI / 2 });
      }
    }
    if (!s.grounded) this.landingVy = s.vy;

    // Wheel dust in the color of what you're riding on.
    if (s.grounded && Math.abs(s.vx) > 4 && Math.random() < 0.5) {
      const w = s.wheels[0];
      const color = s.surface && s.surface !== 'platform' ? INKS[s.surface].color : '#b18cff';
      this.renderer.particles.burst(w.x, w.y - this.spec.wheel.r, { count: 1, color, speed: 2, life: 0.5, angle: Math.PI * 0.85, spread: 0.6, size: 0.12 });
    }

    // Trickle refill on solid terrain keeps the flow going.
    if (s.grounded && s.surface === 'platform') this.tank.refill(TANK.trickle * dt);

    const landing = this.tricks.update(dt, s.angle, s.grounded);
    if (this.tricks.isAirborne && this.opts.tutorial && !this.hints.has('flip') && this.distance > 60) this.hint('flip');
    if (landing) this.onTrick(landing);

    this.collect(s);
    this.checkTutorial(s);
    this.checkStuck(s, ctl, dt);
    this.streamWorld();

    if (s.crashed) this.crash('crash');
    else if (s.y < this.floorBelow(s.x) - 18) this.crash('void');
  }

  private onTrick(l: TrickLanding) {
    this.trickPoints += l.points;
    this.flips += l.flips;
    this.tank.refill(l.ink);
    if (!this.bestTrick || l.points > this.bestTrick.points) this.bestTrick = { label: l.label, points: l.points };
    if (l.flips > 0) this.doneHint('flip');
    sfx.trick(l.flips);
    const s = this.lastVehicle;
    this.renderer.particles.burst(s.x, s.y, { count: 24 + l.flips * 10, color: '#ffd23f', speed: 8, life: 0.8 });
    this.opts.onEvent?.({ type: 'trick', landing: l });
  }

  private collect(s: VehicleState) {
    for (const p of this.pickups) {
      if (p.taken || Math.abs(p.x - s.x) > 3) continue;
      if (dist(p, s) < 1.7) {
        p.taken = true;
        if (p.kind === 'ink') this.tank.refill(TANK.dropRefill);
        else this.stars++;
        sfx.pickup(p.kind);
        this.renderer.particles.burst(p.x, p.y, {
          count: 16,
          color: p.kind === 'ink' ? INKS.road.color : '#ffd23f',
          speed: 6,
          life: 0.6,
        });
        this.opts.onEvent?.({ type: 'pickup', kind: p.kind });
      }
    }
  }

  private crash(cause: RunResult['cause']) {
    this.state = 'crashing';
    this.cause = cause;
    this.crashTimer = cause === 'void' ? 0.9 : 1.4;
    this.tricks.reset();
    this.endStroke();
    sfx.engineStop();
    if (cause === 'crash') {
      sfx.crash();
      const s = this.lastVehicle;
      this.renderer.particles.burst(s.x, s.y, { count: 60, color: '#ff4fd8', speed: 10, life: 1.1 });
      this.renderer.particles.burst(s.x, s.y, { count: 30, color: '#ffd23f', speed: 6, life: 0.9 });
      this.camera.shake = 1;
      this.renderer.flash = 1;
    } else {
      sfx.fall();
    }
  }

  private finish() {
    if (this.opts.attract) {
      this.resetForAttract();
      return;
    }
    this.state = 'over';
    if (this.overSent) return;
    this.overSent = true;
    this.emitHud(true);
    this.opts.onOver?.({
      vehicle: this.spec.id,
      seed: this.opts.seed,
      daily: !!this.opts.daily,
      distance: Math.floor(this.distance),
      score: this.score,
      stars: this.stars,
      flips: this.flips,
      bestTrick: this.bestTrick?.label ?? null,
      inkDrawn: Math.round(this.inkDrawn),
      cause: this.cause,
      seconds: Math.round(this.time),
    });
  }

  get score() {
    return Math.floor(this.distance * SCORE.perMeter) + this.stars * SCORE.star + this.trickPoints;
  }

  // ─── drawing ─────────────────────────────────────────────────────────────

  private updateDrawing() {
    if (!this.mouse.drawing || (this.state !== 'running' && this.state !== 'ready')) {
      sfx.scribble(false);
      return;
    }
    const p = this.screenToWorld(this.mouse);
    if (!this.builder) {
      const id = this.nextStrokeId++;
      this.builder = { id, b: new StrokeBuilder(this.inkKind, this.tank) };
    }
    const { id, b } = this.builder;
    const before = b.length;
    const r = b.add(p, this.lastVehicle);
    if (r === 'added') {
      this.strokeDirty = true;
      this.inkDrawn += b.length - before;
      if (b.points.length > 1 && Math.random() < 0.6) {
        this.renderer.particles.burst(p.x, p.y, { count: 1, color: INKS[b.kind].color, speed: 1, life: 0.5, gravity: -6, size: 0.1 });
      }
    } else if (r === 'blocked') {
      // Crossing your own vehicle ends this stroke; moving away starts a new one.
      this.endStroke();
      return;
    } else if (r === 'empty') {
      if (this.opts.tutorial) this.hint('empty');
      this.endStroke();
      this.mouse.drawing = false;
      sfx.empty();
      return;
    }
    sfx.scribble(true, b.points.length > 1 ? 1 : 0.3);
    if (this.strokeDirty && b.points.length >= 2) {
      this.strokeDirty = false;
      this.upsertStroke(id, b.points, b.kind);
    }
  }

  private upsertStroke(id: number, points: Vec[], kind: InkKind) {
    this.physics.setStroke(id, points, kind);
    let maxX = -Infinity;
    for (const p of points) maxX = Math.max(maxX, p.x);
    const existing = this.strokes.get(id);
    this.strokes.set(id, { id, kind, points: [...points], maxX, born: existing?.born ?? this.time });
    if (this.strokes.size > MAX_STROKES) {
      const oldest = [...this.strokes.values()].sort((a, b) => a.born - b.born)[0];
      this.removeStroke(oldest.id);
    }
  }

  private endStroke() {
    if (this.builder && this.builder.b.points.length >= 2) this.upsertStroke(this.builder.id, this.builder.b.points, this.builder.b.kind);
    this.builder = null;
    this.strokeDirty = false;
  }

  private removeStroke(id: number) {
    this.physics.removeStroke(id);
    this.strokes.delete(id);
  }

  /** Right-click: wipe a stroke and get half its ink back. */
  erase(p: Vec) {
    let best: Stroke | null = null;
    let bestD = 0.9;
    for (const s of this.strokes.values()) {
      const d = distToStroke(p, s.points);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (!best) return false;
    this.tank.refill(strokeCost(best.points, best.kind) * 0.5);
    this.removeStroke(best.id);
    sfx.erase();
    for (const q of best.points.filter((_, i) => i % 3 === 0)) {
      this.renderer.particles.burst(q.x, q.y, { count: 2, color: INKS[best.kind].color, speed: 2, life: 0.4 });
    }
    return true;
  }

  /** Programmatic stroke (autopilot, tests). Charges ink unless attract mode. */
  drawStroke(points: Vec[], kind: InkKind = this.inkKind): number {
    const b = new StrokeBuilder(kind, this.tank, !!this.opts.attract);
    for (const p of points) b.add(p, this.lastVehicle);
    if (b.points.length < 2) return -1;
    const id = this.nextStrokeId++;
    this.upsertStroke(id, b.points, kind);
    return id;
  }

  // ─── world streaming ─────────────────────────────────────────────────────

  private streamWorld() {
    const ahead = this.lastVehicle ? this.lastVehicle.x + 140 : 160;
    while (this.course.frontier < ahead) {
      const c = this.course.next();
      this.platforms.push(c.platform);
      this.physics.addPlatform(c.platform);
      if (c.gap) this.gaps.push(c.gap);
      for (const p of c.pickups) this.pickups.push({ ...p, taken: false });
      if (c.updraft) this.updrafts.push(c.updraft);
    }
    const behind = (this.lastVehicle?.x ?? 0) - 70;
    while (this.platforms.length && this.platforms[0].x1 < behind) {
      this.physics.removePlatform(this.platforms.shift()!.id);
    }
    while (this.gaps.length && this.gaps[0].to.x < behind) this.gaps.shift();
    while (this.pickups.length && this.pickups[0].x < behind) this.pickups.shift();
    while (this.updrafts.length && this.updrafts[0].x1 < behind) this.updrafts.shift();
    for (const s of [...this.strokes.values()]) if (s.maxX < behind) this.removeStroke(s.id);
  }

  /** Lowest terrain near x — below it by a margin you're lost to the void. */
  private floorBelow(x: number): number {
    let low = Infinity;
    for (const p of this.platforms) {
      if (p.x1 < x - 60 || p.x0 > x + 60) continue;
      for (const q of p.points) low = Math.min(low, q.y);
    }
    return Number.isFinite(low) ? low : 0;
  }

  /** The next gap ahead of the vehicle (tutorial ghost line, autopilot, tests). */
  nextGap(): Gap | null {
    const x = this.lastVehicle.x;
    return this.gaps.find((g) => g.to.x > x + 1) ?? null;
  }

  // ─── tutorial ────────────────────────────────────────────────────────────

  private hint(id: HintId) {
    if (this.hints.has(id)) return;
    this.hints.add(id);
    this.activeHint = id;
    this.opts.onEvent?.({ type: 'hint', id, text: HINTS[id] });
  }

  private doneHint(id: HintId) {
    if (this.activeHint === id) {
      this.activeHint = null;
      this.opts.onEvent?.({ type: 'hint-done', id });
    }
    if (id === 'draw') this.tutorialSlow = false;
  }

  get ghostGap(): Gap | null {
    return this.activeHint === 'draw' ? this.gaps[0] ?? null : null;
  }

  private checkTutorial(s: VehicleState) {
    if (!this.opts.tutorial) return;
    const first = this.gaps[0];
    if (first && first.id === this.firstGapId) {
      const ahead = first.from.x - s.x;
      const bridged = [...this.strokes.values()].some((st) => st.points[0] && Math.min(...st.points.map((p) => p.x)) < first.from.x && st.maxX > first.to.x);
      if (!this.hints.has('draw') && ahead < 16 && ahead > 0 && !bridged) {
        this.hint('draw');
        this.tutorialSlow = true;
      }
      if (this.activeHint === 'draw' && (bridged || s.x > first.to.x)) this.doneHint('draw');
      if (s.x > first.to.x + 4 && !this.hints.has('inks')) this.hint('inks');
    }
    const cliff = this.gaps.find((g) => g.kind === 'cliff' && g.from.x - s.x < 22 && g.from.x > s.x);
    if (cliff) this.hint('cliff');
  }

  private firstGapId = -1;

  /** Pressing gas but going nowhere for a while → a gentle way out (always shown). */
  private checkStuck(s: VehicleState, ctl: Controls, dt: number) {
    if (this.opts.attract) return;
    this.stuckFor = ctl.throttle > 0 && Math.abs(s.vx) < 0.5 ? this.stuckFor + dt : 0;
    if (this.stuckFor > 2.5 && this.activeHint !== 'stuck') {
      this.hints.delete('stuck');
      this.hint('stuck');
    }
    if (this.stuckFor === 0 && this.activeHint === 'stuck') this.doneHint('stuck');
  }

  // ─── autopilot (attract mode) ───────────────────────────────────────────

  private autopilot(): Controls {
    const s = this.lastVehicle;
    for (const g of this.gaps) {
      if (this.bridgedGaps.has(g.id) || g.from.x - s.x > 16 || g.to.x < s.x) continue;
      this.bridgedGaps.add(g.id);
      const kind: InkKind = g.id % 3 === 0 ? 'boost' : 'road';
      const pts: Vec[] = [];
      const from = g.kind === 'cliff' ? { x: g.from.x - 10, y: g.from.y } : { x: g.from.x - 1.2, y: g.from.y };
      const to = { x: g.to.x + 1, y: g.to.y };
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        pts.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t + 0.05 });
      }
      this.drawStroke(pts, kind);
    }
    const lean = s.grounded ? 0 : clamp(-s.angle * 2.5, -1, 1);
    return { throttle: 0.75, lean, hop: false };
  }

  private resetForAttract() {
    // Quietly start over on a fresh course.
    this.opts.onOver?.({ ...this.emptyResult(), cause: this.cause });
  }

  private emptyResult(): RunResult {
    return {
      vehicle: this.spec.id,
      seed: this.opts.seed,
      daily: false,
      distance: Math.floor(this.distance),
      score: this.score,
      stars: this.stars,
      flips: this.flips,
      bestTrick: null,
      inkDrawn: 0,
      cause: 'crash',
      seconds: 0,
    };
  }

  // ─── camera, audio, hud ─────────────────────────────────────────────────

  private updateCamera(dt: number) {
    const s = this.lastVehicle;
    const cam = this.camera;
    const speed = Math.hypot(s.vx, s.vy);
    cam.zoom = damp(cam.zoom, 1 - clamp(speed / 45, 0, 0.2), 1.5, dt);
    const lookAhead = this.opts.attract ? 3 : this.renderer.metersAcross(cam) * 0.16 + clamp(s.vx * 0.3, -3, 7);
    cam.x = damp(cam.x, s.x + lookAhead, 4, dt);
    cam.y = damp(cam.y, s.y + 1.2, 3, dt);
    cam.shake = Math.max(0, cam.shake - dt * 2.2) * (this.opts.shake ?? 1) * (this.opts.reducedMotion ? 0 : 1);
  }

  private updateAudio() {
    if (this.opts.attract) return;
    if (this.state === 'running' || this.state === 'ready') {
      const s = this.lastVehicle;
      const ratio = clamp(Math.abs(s.vx) / (this.spec.motor.maxSpeed * this.spec.wheel.r), 0, 1.2);
      sfx.engine(ratio, this.controls().throttle, s.grounded);
    }
  }

  private emitHud(force = false) {
    if (!this.opts.onHud) return;
    this.hudTimer = force ? 0.066 : 0.066;
    const s = this.lastVehicle;
    this.opts.onHud({
      distance: Math.floor(this.distance),
      score: this.score,
      ink: this.tank.level,
      inkKind: this.inkKind,
      focus: this.focus,
      focusActive: this.focusActive,
      stars: this.stars,
      combo: this.tricks.combo,
      speedKmh: Math.round(Math.abs(s.vx) * 3.6),
      state: this.state,
    });
  }

  /** For the renderer. */
  get drawingStroke(): { points: Vec[]; kind: InkKind } | null {
    return this.builder ? { points: this.builder.b.points, kind: this.builder.b.kind } : null;
  }

  get pointer() {
    return this.opts.attract || !this.mouse.inside ? null : { ...this.mouse };
  }

  get canDrawHere(): boolean {
    if (!this.pointer) return false;
    return dist(this.screenToWorld(this.mouse), this.lastVehicle) >= 1.9;
  }
}
