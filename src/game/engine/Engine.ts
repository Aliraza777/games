import { Application, BitmapText, ColorMatrixFilter, Container, type Ticker } from 'pixi.js';
import { audio } from '../../audio/AudioManager';
import { clamp, damp, lerp, mean, type Rect, type Vec } from '../../lib/math';
import { mulberry32, type Rng } from '../../lib/rng';
import type { SettingsData } from '../../store/settings';
import { palettes, type Palette } from '../../theme/palettes';
import { Crosshair } from '../entities/Crosshair';
import { Target, type TargetOpts } from '../entities/Target';
import { Trail } from '../entities/Trail';
import { Background } from '../fx/Background';
import { FONT_FAMILY, Fx } from '../fx/Fx';
import type { Mode } from '../modes/BaseMode';
import { createMode } from '../modes';
import { modeMeta } from '../modes/meta';
import { comboMultiplier, comboTier, gradeFor } from '../scoring/scoring';
import type { HudState, ModeId, RunResult } from '../types';
import { createTextures, type FxTextures } from './textures';

/** Logic runs at a fixed 240 Hz so scoring is identical on 60 Hz and 240 Hz screens. */
const STEP = 1 / 240;
const HUD_TOP = 64;

export interface EngineCallbacks {
  onHud: (s: HudState) => void;
  onTierUp: (tier: number) => void;
  /** Pointer lock lost, window blurred or tab hidden while running. */
  onFocusLost: () => void;
  onEnd: (result: RunResult) => void;
}

export interface EngineOptions {
  mode: ModeId;
  seed: number;
  daily: boolean;
  settings: SettingsData;
  reducedMotion: boolean;
  callbacks: EngineCallbacks;
}

export interface RewardOpts {
  x: number;
  y: number;
  points: number;
  radius?: number;
  perfect?: boolean;
  offset?: { d: number; dx: number; dy: number };
  reactionMs?: number;
  /** Floating text instead of "+points". */
  label?: string;
  /** Small sparkle, no hit sound or shake (tracking ticks). */
  quiet?: boolean;
  /** Soft chime + gentle burst (Zen). */
  soft?: boolean;
  petals?: boolean;
  countHit?: boolean;
}

export interface PenaltyOpts {
  x: number;
  y: number;
  kind: 'miss' | 'expire' | 'early';
  label?: string;
  countMiss?: boolean;
  quiet?: boolean;
}

type EngineState = 'loading' | 'idle' | 'running' | 'paused' | 'ended';

export class Engine {
  readonly app = new Application();
  readonly settings: SettingsData;
  readonly palette: Palette;
  readonly reducedMotion: boolean;
  readonly clean: boolean;
  readonly rng: Rng;
  readonly modeId: ModeId;
  readonly hue: number;

  tex!: FxTextures;
  fx!: Fx;
  bg!: Background;
  mode!: Mode;
  /** Mode-owned layer under the targets (trails, connectors). */
  readonly underlay = new Container();

  state: EngineState = 'loading';
  width = 0;
  height = 0;
  readonly cursor: Vec = { x: 0, y: 0 };
  /** Game time in seconds (stops while paused, slows during slow-mo). */
  time = 0;

  score = 0;
  combo = 0;
  bestCombo = 0;
  hits = 0;
  misses = 0;
  perfects = 0;
  readonly reactions: number[] = [];
  readonly offsets: Vec[] = [];

  private readonly opts: EngineOptions;
  private readonly host: HTMLElement;
  private readonly world = new Container();
  private readonly targetLayer = new Container();
  private readonly cursorLayer = new Container();
  private targets: Target[] = [];
  private crosshair!: Crosshair;
  private ribbon!: Trail;
  private comboText!: BitmapText;
  private comboPop = 0;
  private tier = 0;
  private acc = 0;
  private realTime = 0;
  private hitstopUntil = 0;
  private slow = { scale: 1, left: 0, dur: 1 };
  private trauma = 0;
  private breakFx = 0;
  private breakFilter: ColorMatrixFilter | null = null;
  private frameEma = 1 / 60;
  private disposed = false;
  private initialized = false;
  private unbind: (() => void)[] = [];

  constructor(host: HTMLElement, opts: EngineOptions) {
    this.host = host;
    this.opts = opts;
    this.settings = opts.settings;
    this.palette = palettes[opts.settings.palette] ?? palettes.default;
    this.reducedMotion = opts.reducedMotion;
    this.clean = opts.settings.effects === 'clean';
    this.rng = mulberry32(opts.seed);
    this.modeId = opts.mode;
    this.hue = this.palette[modeMeta(opts.mode).hue];
  }

  async init() {
    await this.app.init({
      resizeTo: this.host,
      background: this.palette.bg,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
      preference: 'webgl',
    });
    this.initialized = true;
    if (this.disposed) return this.teardown();
    try {
      await document.fonts?.ready;
    } catch {
      /* fonts are a nicety */
    }
    if (this.disposed) return this.teardown();

    const canvas = this.app.canvas;
    canvas.style.display = 'block';
    canvas.style.cursor = 'none';
    canvas.style.touchAction = 'none';
    this.host.appendChild(canvas);

    this.tex = createTextures();
    const fxOpts = { reducedMotion: this.reducedMotion, clean: this.clean };
    this.bg = new Background(this.tex, this.palette, fxOpts);
    this.fx = new Fx(this.tex, fxOpts);
    this.crosshair = new Crosshair(this.settings.crosshair);
    this.ribbon = new Trail({ length: 22, width: 7, color: this.palette.hot, alpha: 0.55 });
    this.ribbon.view.blendMode = 'add';
    this.comboText = new BitmapText({
      text: '',
      style: { fontFamily: FONT_FAMILY, fontSize: 64, fill: 0xffffff, fontWeight: 'bold' },
    });
    this.comboText.anchor.set(0, 0.5);

    this.world.addChild(this.underlay, this.targetLayer, this.fx.ringLayer, this.fx.particleLayer, this.fx.textLayer);
    this.cursorLayer.addChild(this.ribbon.view, this.crosshair.view, this.comboText);
    this.app.stage.addChild(this.bg.view, this.world, this.cursorLayer);

    this.onResize(this.app.screen.width, this.app.screen.height);
    this.cursor.x = this.width / 2;
    this.cursor.y = this.height / 2;
    this.app.renderer.on('resize', this.onResize);

    this.mode = createMode(this.modeId, this);
    this.bindInput();
    this.app.ticker.add(this.tick);
    this.state = 'idle';
  }

  // ─── lifecycle ───────────────────────────────────────────────────────────

  start() {
    if (this.state !== 'idle') return;
    this.state = 'running';
    this.mode.start();
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.mode.pause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.mode.resume();
  }

  /** Leave without a result (Zen, or quitting mid-run). */
  quit() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.mode?.destroy();
    this.releasePointer();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.quit();
    if (this.initialized) this.teardown();
  }

  private teardown() {
    this.unbind.forEach((u) => u());
    this.unbind = [];
    this.app.ticker?.remove(this.tick);
    this.app.destroy(true, { children: true, texture: true, textureSource: true });
  }

  private finish() {
    this.state = 'ended';
    this.mode.destroy();
    this.releasePointer();
    audio.end();
    for (const t of this.targets) t.kill('vanish');
    const result = this.buildResult();
    setTimeout(() => {
      if (!this.disposed) this.opts.callbacks.onEnd(result);
    }, 650);
  }

  // ─── input ───────────────────────────────────────────────────────────────

  /** Must be called from a user gesture. Resolves false if lock is off or refused. */
  async lockPointer(): Promise<boolean> {
    if (!this.settings.pointerLock || !this.initialized || this.disposed) return false;
    const canvas = this.app.canvas as HTMLCanvasElement & {
      requestPointerLock(opts?: { unadjustedMovement?: boolean }): Promise<void> | void;
    };
    try {
      await canvas.requestPointerLock({ unadjustedMovement: true });
    } catch {
      try {
        await canvas.requestPointerLock();
      } catch {
        return false;
      }
    }
    return document.pointerLockElement === canvas;
  }

  private releasePointer() {
    if (this.initialized && document.pointerLockElement === this.app.canvas) document.exitPointerLock();
  }

  private bindInput() {
    const canvas = this.app.canvas;
    const isLocked = () => document.pointerLockElement === canvas;

    const onMove = (e: PointerEvent | MouseEvent) => {
      if (isLocked()) {
        const s = this.settings.sensitivity;
        this.cursor.x = clamp(this.cursor.x + e.movementX * s, 0, this.width);
        this.cursor.y = clamp(this.cursor.y + e.movementY * s, 0, this.height);
      } else {
        const r = canvas.getBoundingClientRect();
        this.cursor.x = e.clientX - r.left;
        this.cursor.y = e.clientY - r.top;
      }
    };
    // pointerrawupdate delivers input as soon as it arrives, not once per frame.
    const moveEvent = 'onpointerrawupdate' in window ? 'pointerrawupdate' : 'pointermove';
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || this.state !== 'running') return;
      e.preventDefault();
      this.crosshair.fire();
      this.mode.pointerDown(this.cursor.x, this.cursor.y, e.timeStamp);
    };
    const onLockChange = () => {
      if (!isLocked() && this.state === 'running') this.opts.callbacks.onFocusLost();
    };
    const onBlur = () => {
      if (this.state === 'running') this.opts.callbacks.onFocusLost();
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    const onContext = (e: Event) => e.preventDefault();

    document.addEventListener(moveEvent, onMove as EventListener);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('contextmenu', onContext);
    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    this.unbind.push(
      () => document.removeEventListener(moveEvent, onMove as EventListener),
      () => canvas.removeEventListener('pointerdown', onDown),
      () => canvas.removeEventListener('contextmenu', onContext),
      () => document.removeEventListener('pointerlockchange', onLockChange),
      () => window.removeEventListener('blur', onBlur),
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => this.app.renderer.off('resize', this.onResize),
    );
  }

  private onResize = (w: number, h: number) => {
    this.width = w;
    this.height = h;
    this.bg.resize(w, h);
    this.cursor.x = clamp(this.cursor.x, 0, w);
    this.cursor.y = clamp(this.cursor.y, 0, h);
  };

  // ─── API for modes ───────────────────────────────────────────────────────

  /** Scales with the window so targets feel the same on a laptop and a 1440p monitor. */
  get unit(): number {
    return clamp(Math.min(this.width, this.height) / 850, 0.75, 1.35);
  }

  baseRadius(): number {
    return 30 * this.unit * this.settings.targetScale;
  }

  /** Centered play area (capped so huge monitors don't mean huge flicks), minus HUD and margin. */
  playfield(margin: number): Rect {
    const w = Math.min(this.width, 1600);
    const h = Math.min(this.height, 1000);
    const x = (this.width - w) / 2 + margin;
    const y = (this.height - h) / 2 + margin + HUD_TOP;
    return { x, y, w: Math.max(10, w - 2 * margin), h: Math.max(10, h - 2 * margin - HUD_TOP) };
  }

  spawnTarget(o: Omit<TargetOpts, 'bornAt' | 'reducedMotion' | 'color' | 'coolColor'> & { color?: number }): Target {
    const t = new Target(this.tex, {
      ...o,
      bornAt: this.time,
      color: o.color ?? this.hue,
      coolColor: this.palette.cool,
      reducedMotion: this.reducedMotion,
    });
    this.targets.push(t);
    this.targetLayer.addChild(t.view);
    return t;
  }

  reward(o: RewardOpts): number {
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const gained = Math.round(o.points * comboMultiplier(this.combo));
    this.score += gained;
    if (o.countHit !== false) this.hits++;
    if (o.perfect) this.perfects++;
    if (o.reactionMs != null) this.reactions.push(o.reactionMs);
    if (o.offset) this.offsets.push({ x: o.offset.dx, y: o.offset.dy });
    this.comboPop = 1;

    const tier = comboTier(this.combo);
    if (tier > this.tier) {
      this.tier = tier;
      this.bg.setTier(tier);
      audio.setMusicIntensity(tier);
      if (!o.quiet) audio.tierUp(tier);
      this.opts.callbacks.onTierUp(tier);
    }

    const r = o.radius ?? this.baseRadius();
    const p = this.palette;
    const tierBoost = [1, 1.3, 1.7, 2.2][this.tier];

    if (o.quiet) {
      this.fx.burst(o.x, o.y, { count: 3, color: this.hue, speed: 90, size: 6, life: 0.35, radius: r });
      return gained;
    }

    if (o.soft) {
      this.fx.burst(o.x, o.y, { count: 10, color: this.hue, speed: 120, size: 10, life: 0.9, drag: 2.5, radius: r });
      this.fx.ripple(o.x, o.y, { color: this.hue, from: r, to: r * 2.6, life: 0.8, alpha: 0.5 });
      audio.soft(this.combo);
      this.bg.pulse(0.3);
      return gained;
    }

    this.fx.burst(o.x, o.y, {
      count: Math.round((o.perfect ? 16 : 10) * tierBoost),
      color: this.hue,
      speed: 380,
      size: 9,
      life: 0.45,
      radius: r,
    });
    this.fx.burst(o.x, o.y, { count: Math.round(6 * tierBoost), color: 0xffffff, speed: 520, size: 7, life: 0.3, texture: 'spark' });
    if (o.petals) this.fx.burst(o.x, o.y, { count: 6, color: this.hue, speed: 220, size: r * 0.9, life: 0.6, texture: 'petal', gravity: 260, drag: 3, radius: r });
    this.fx.ripple(o.x, o.y, { color: this.hue, from: r, to: r * 2.2, life: 0.35 });
    if (o.perfect) {
      this.fx.ripple(o.x, o.y, { color: 0xffffff, from: r * 0.4, to: r * 3, life: 0.28, alpha: 1 });
      if (this.mode.allowHitstop) this.hitstop(0.04);
      this.shake(0.28);
    } else {
      this.shake(0.08);
    }
    this.fx.floater(o.x, o.y - r - 8, o.label ?? `+${gained}`, {
      color: o.perfect ? p.warm : p.text,
      size: o.perfect ? 26 : 20,
    });
    this.bg.pulse(o.perfect ? 1 : 0.5);
    audio.hit(this.combo, !!o.perfect);
    return gained;
  }

  penalize(o: PenaltyOpts) {
    if (o.countMiss !== false) this.misses++;
    const broke = this.combo;
    this.combo = 0;
    if (this.tier > 0) {
      this.tier = 0;
      this.bg.setTier(0);
      audio.setMusicIntensity(0);
    }
    if (broke >= 5) {
      this.breakFx = 1;
      audio.comboBreak();
    }
    if (o.quiet) return;
    this.fx.ripple(o.x, o.y, { color: this.palette.bad, from: 4, to: 26, life: 0.3, alpha: 0.6 });
    if (o.label) this.fx.floater(o.x, o.y - 24, o.label, { color: this.palette.muted, size: 15, rise: 20 });
    if (o.kind === 'early') audio.early();
    else audio.miss();
  }

  hitstop(seconds: number) {
    if (this.reducedMotion) return;
    this.hitstopUntil = this.realTime + seconds;
  }

  slowMo(scale: number, seconds: number) {
    if (this.reducedMotion) return;
    this.slow = { scale, left: seconds, dur: seconds };
  }

  shake(amount: number) {
    if (this.reducedMotion) return;
    this.trauma = Math.min(1, this.trauma + amount * this.settings.shake);
  }

  accuracy(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  // ─── frame ───────────────────────────────────────────────────────────────

  private tick = (ticker: Ticker) => {
    const frameDt = Math.min(ticker.deltaMS / 1000, 0.1);
    this.realTime += frameDt;
    this.adaptBudget(frameDt);

    let simDt = 0;
    if (this.state === 'running') {
      let scale = 1;
      if (this.slow.left > 0) {
        this.slow.left -= frameDt;
        // Hold the slow-down for the first half, then ease back to real time.
        scale = lerp(1, this.slow.scale, clamp((this.slow.left / this.slow.dur) * 2, 0, 1));
      }
      simDt = frameDt * scale;
      this.acc += simDt;
      while (this.acc >= STEP) {
        this.acc -= STEP;
        this.time += STEP;
        this.mode.step(STEP);
        if (this.mode.isOver()) {
          this.finish();
          break;
        }
      }
    }
    // Hit-stop freezes what you see, never the clock — runs stay exactly as long as advertised.
    const frozen = this.realTime < this.hitstopUntil;
    const visDt = this.state === 'running' ? (frozen ? 0 : simDt) : this.state === 'paused' ? 0 : frameDt;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (!t.update(visDt)) {
        t.view.destroy({ children: true });
        this.targets.splice(i, 1);
      }
    }
    if (this.state === 'running') this.mode.render(visDt);
    this.fx.update(visDt);
    this.bg.update(this.state === 'paused' ? 0 : frameDt);

    // Screen shake: offset grows with trauma², so small hits barely register.
    this.trauma = Math.max(0, this.trauma - frameDt * 1.8);
    const s = this.trauma * this.trauma * 14;
    this.world.position.set((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);

    this.crosshair.update(frameDt, this.cursor.x, this.cursor.y);
    this.updateCursorExtras(frameDt);
    this.updateBreakFx(frameDt);

    this.opts.callbacks.onHud({
      score: this.score,
      combo: this.combo,
      tier: this.tier,
      progress: this.mode.progress(),
      timeLeft: this.mode.timeLeft(),
      accuracy: this.mode.liveAccuracy(),
      label: this.mode.hudLabel(),
      showScore: this.mode.showScore,
    });
  };

  private updateCursorExtras(dt: number) {
    const overdrive = this.tier >= 3 && !this.reducedMotion && !this.clean;
    if (overdrive) this.ribbon.push(this.cursor.x, this.cursor.y);
    else this.ribbon.clear();
    this.ribbon.redraw();

    const show = this.combo >= 2 && this.mode.showScore && this.state === 'running';
    this.comboText.visible = show;
    if (!show) return;
    this.comboPop = damp(this.comboPop, 0, 14, dt);
    this.comboText.text = `×${this.combo}`;
    this.comboText.tint = [this.palette.text, this.palette.accent, this.palette.warm, this.palette.hot][this.tier];
    this.comboText.scale.set((15 / 64) * (1 + 0.45 * this.comboPop));
    this.comboText.position.set(Math.round(this.cursor.x + 20), Math.round(this.cursor.y + 20));
    this.comboText.alpha = 0.85;
  }

  /** Combo break: a short desaturate-and-recover, not a punishing flash. */
  private updateBreakFx(dt: number) {
    if (this.breakFx <= 0) return;
    this.breakFx = Math.max(0, this.breakFx - dt / 0.35);
    if (!this.breakFilter) {
      this.breakFilter = new ColorMatrixFilter();
      this.world.filters = [this.breakFilter];
    }
    this.breakFilter.saturate(-0.85 * this.breakFx);
    if (this.breakFx === 0) {
      this.world.filters = [];
      this.breakFilter.destroy();
      this.breakFilter = null;
    }
  }

  /** Back off particle counts when frames get slow; recover when there's headroom. */
  private adaptBudget(dt: number) {
    this.frameEma = lerp(this.frameEma, dt, 0.05);
    if (this.frameEma > 1 / 50) this.fx.budget = Math.max(0.3, this.fx.budget - dt * 0.5);
    else if (this.frameEma < 1 / 90) this.fx.budget = Math.min(1, this.fx.budget + dt * 0.25);
  }

  // ─── results ─────────────────────────────────────────────────────────────

  private buildResult(): RunResult {
    const summary = this.mode.summary();
    return {
      id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      mode: this.modeId,
      date: Date.now(),
      seed: this.opts.seed,
      daily: this.opts.daily,
      score: this.score,
      accuracy: summary.accuracy,
      hits: this.hits,
      misses: this.misses,
      perfects: this.perfects,
      bestCombo: this.bestCombo,
      avgReaction: summary.avgReaction ?? (this.reactions.length ? mean(this.reactions) : null),
      rating: summary.rating,
      grade: gradeFor(summary.rating),
      duration: this.time,
      offsets: (summary.offsets ?? this.offsets).slice(-400),
      offsetsLabel: summary.offsetsLabel ?? 'Where you clicked',
      histogram: summary.histogram,
      extra: summary.extra,
    };
  }
}
