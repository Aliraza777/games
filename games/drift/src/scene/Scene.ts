import { TAU, clamp, damp, easeInOutSine, easeOutCubic, lerp, lerpRgb } from '../lib/math';
import { mulberry32, type Rng } from '../lib/rng';
import type { Theme } from '../theme';
import { DEFAULT_TREE, buildTree, layoutTree, type TreeNode } from './tree';

export type SceneMode = 'intro' | 'paced' | 'count' | 'pond';

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  phase: number;
  speed: number;
}

interface Firefly {
  bx: number;
  by: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phase: number;
  size: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  strength: number;
}

interface Koi {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  size: number;
  wander: number;
}

interface Constellation {
  x: number;
  y: number;
  scale: number;
  rot: number;
  age: number;
}

interface Shimmer {
  x: number;
  y: number;
  len: number;
  phase: number;
}

const MAX_RIPPLES = 40;
const RING_SLOTS = 9;

/**
 * Canvas 2D scene shared by every practice. All motion is slow and continuous;
 * nothing flashes. With no 2D context (e.g. jsdom) every call is a no-op.
 */
export class Scene {
  // Inputs, set by the session each frame.
  progress = 0;
  guide = 0;
  player: number | null = null;
  growthTarget = 0;
  blossoms = 0;
  count = 0;
  holdProgress: number | null = null;

  private ctx: CanvasRenderingContext2D | null;
  private w = 0;
  private h = 0;
  private t = 0;
  private harmonyGlow = 0;
  private growth = 0;
  private bloom = 0;
  private stars: Star[] = [];
  private fireflies: Firefly[] = [];
  private shimmer: Shimmer[] = [];
  private ripples: Ripple[] = [];
  private koi: Koi[] = [];
  private constellations: Constellation[] = [];
  private ringPulse = new Float32Array(RING_SLOTS);
  private ringFade = 1;
  private closing = 0;
  private hillsFar: number[] = [];
  private hillsNear: number[] = [];
  private tree: TreeNode[];
  private tipOrder: number[] = [];
  private sprite: HTMLCanvasElement | null = null;
  private rng: Rng;

  constructor(
    private canvas: HTMLCanvasElement,
    private theme: Theme,
    private mode: SceneMode,
    private reducedMotion: boolean,
    seed = 1,
  ) {
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    this.ctx = ctx;
    this.rng = mulberry32(seed);
    this.tree = buildTree(DEFAULT_TREE, mulberry32(seed + 7));
    // Blossoms appear on tips in a scattered (but stable) order.
    const tips = this.tree.map((n, i) => (n.depth === DEFAULT_TREE.depth ? i : -1)).filter((i) => i >= 0);
    const r = mulberry32(seed + 11);
    this.tipOrder = tips.sort(() => r() - 0.5);
    if (this.ctx) this.sprite = this.makeSprite();
    this.resize();
  }

  get horizon() {
    return this.h * (this.mode === 'pond' ? 0.4 : 0.7);
  }

  /** Centre of the breathing orb / counting ring. */
  get focus() {
    return { x: this.w / 2, y: this.h * (this.mode === 'count' ? 0.36 : 0.3) };
  }

  get size() {
    return Math.min(this.w, this.h);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.buildHills();
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = c.clientWidth || 800;
    this.h = c.clientHeight || 600;
    c.width = Math.round(this.w * dpr);
    c.height = Math.round(this.h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.populate();
  }

  // ─── events ──────────────────────────────────────────────────────────────

  ripple(x: number, y: number, strength = 1) {
    this.ripples.push({ x, y, age: 0, strength });
    if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
    for (const k of this.koi) {
      const dx = k.x - x, dy = k.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 180) {
        k.vx += (dx / d) * 60 * strength;
        k.vy += (dy / d) * 30 * strength;
      }
    }
  }

  starLit(index: number) {
    if (index >= 0 && index < RING_SLOTS) this.ringPulse[index] = 1;
  }

  /** Ninth breath: the ring becomes a constellation and drifts into the sky. */
  ringClosed() {
    this.closing = 1;
    const sky = this.horizon;
    this.constellations.push({
      x: this.w * (0.12 + this.rng() * 0.76),
      y: sky * (0.1 + this.rng() * 0.45),
      scale: 0.22 + this.rng() * 0.12,
      rot: this.rng() * TAU,
      age: 0,
    });
    if (this.constellations.length > 14) this.constellations.shift();
  }

  /** Miscount or drift: lit stars softly dim back — no harsh feedback. */
  ringReset() {
    this.ringFade = 0;
  }

  // ─── frame ───────────────────────────────────────────────────────────────

  render(dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const rm = this.reducedMotion;
    this.t += dt;
    this.growth = damp(this.growth, this.growthTarget, 1.2, dt);
    this.bloom = damp(this.bloom, this.blossoms, 2, dt);
    const harmony = this.player == null ? 0.6 : 1 - clamp(Math.abs(this.player - this.guide) / 0.25, 0, 1);
    this.harmonyGlow = damp(this.harmonyGlow, harmony, 3, dt);
    this.closing = Math.max(0, this.closing - dt / 2.2);
    this.ringFade = Math.min(1, this.ringFade + dt / 0.9);
    for (let i = 0; i < RING_SLOTS; i++) this.ringPulse[i] = Math.max(0, this.ringPulse[i] - dt * 1.4);

    const p = easeInOutSine(clamp(this.progress, 0, 1));
    this.drawSky(ctx, p);
    this.drawStars(ctx, p, rm);
    this.drawConstellations(ctx, dt);
    this.drawHills(ctx, p);
    this.drawWater(ctx, p, rm);
    if (this.mode === 'pond') {
      this.updateKoi(dt, rm);
      this.drawRipples(ctx, dt);
      this.drawKoi(ctx);
    }
    if (this.mode === 'paced') this.drawTree(ctx, rm);
    this.drawFireflies(ctx, rm);
    if (this.mode === 'paced' || this.mode === 'intro') this.drawOrb(ctx);
    if (this.mode === 'count') this.drawRing(ctx);
  }

  destroy() {
    this.ctx = null;
  }

  // ─── setup ───────────────────────────────────────────────────────────────

  private makeSprite(): HTMLCanvasElement {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const c = s.getContext('2d');
    if (c) {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }
    return s;
  }

  private populate() {
    const r = mulberry32(42);
    const sky = this.horizon;
    this.stars = Array.from({ length: Math.round((this.w * sky) / 7000) + 40 }, () => ({
      x: r() * this.w,
      y: r() * sky * 0.95,
      r: 0.4 + r() * 1.1,
      a: 0.25 + r() * 0.6,
      phase: r() * TAU,
      speed: 0.3 + r() * 0.8,
    }));
    const flyCount = this.reducedMotion ? 10 : 26;
    this.fireflies = Array.from({ length: flyCount }, () => ({
      bx: r() * this.w,
      by: this.mode === 'pond' ? sky + r() * (this.h - sky) : sky * (0.35 + r() * 0.65),
      ax: 20 + r() * 50,
      ay: 10 + r() * 30,
      fx: 0.05 + r() * 0.12,
      fy: 0.07 + r() * 0.14,
      phase: r() * TAU,
      size: 6 + r() * 10,
    }));
    this.shimmer = Array.from({ length: 70 }, () => ({
      x: r() * this.w,
      y: sky + 4 + (r() ** 1.6) * (this.h - sky - 4),
      len: 8 + r() * 40,
      phase: r() * TAU,
    }));
    if (this.mode === 'pond' && this.koi.length === 0) {
      this.koi = Array.from({ length: 5 }, () => ({
        x: r() * this.w,
        y: sky + 40 + r() * (this.h - sky - 80),
        vx: (r() - 0.5) * 30,
        vy: (r() - 0.5) * 10,
        heading: r() * TAU,
        size: 14 + r() * 10,
        wander: r() * TAU,
      }));
    }
    this.buildHills();
  }

  private buildHills() {
    const r = mulberry32(9);
    const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
    const n = 64;
    this.hillsFar = Array.from({ length: n + 1 }, (_, i) => {
      const x = i / n;
      return 0.5 + 0.5 * (Math.sin(x * 5 + ph[0]) * 0.6 + Math.sin(x * 13 + ph[1]) * 0.25 + Math.sin(x * 29 + ph[2]) * 0.1);
    });
    this.hillsNear = Array.from({ length: n + 1 }, (_, i) => {
      const x = i / n;
      return 0.5 + 0.5 * (Math.sin(x * 3 + ph[3]) * 0.7 + Math.sin(x * 11 + ph[1]) * 0.2);
    });
  }

  // ─── layers ──────────────────────────────────────────────────────────────

  private drawSky(ctx: CanvasRenderingContext2D, p: number) {
    const th = this.theme;
    const top = lerpRgb(th.skyNight[0], th.skyDawn[0], p);
    const bottom = lerpRgb(th.skyNight[1], th.skyDawn[1], p);
    const g = ctx.createLinearGradient(0, 0, 0, this.horizon);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.horizon + 1);

    // The sun rises with the session — progress without a ticking clock.
    if (p > 0.02) {
      const sx = this.w / 2;
      const sy = this.horizon + this.h * 0.12 * (1 - p);
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(this.w, this.h) * 0.6);
      rg.addColorStop(0, hexA(th.accent2, 0.45 * p));
      rg.addColorStop(1, hexA(th.accent2, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, this.w, this.horizon);
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D, p: number, rm: boolean) {
    const fade = 1 - 0.9 * p;
    ctx.fillStyle = this.theme.glow;
    for (const s of this.stars) {
      const tw = rm ? 1 : 0.6 + 0.4 * Math.sin(this.t * s.speed + s.phase);
      ctx.globalAlpha = s.a * tw * fade;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawHills(ctx: CanvasRenderingContext2D, p: number) {
    const th = this.theme;
    const layer = (pts: number[], base: number, amp: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, this.horizon + 1);
      pts.forEach((v, i) => ctx.lineTo((i / (pts.length - 1)) * this.w, base - v * amp));
      ctx.lineTo(this.w, this.horizon + 1);
      ctx.closePath();
      ctx.fill();
    };
    const lift = lerp(0, 0.25, p);
    layer(this.hillsFar, this.horizon, this.h * 0.09, lerpRgb(th.hills[1], th.skyDawn[1], lift * 0.6));
    layer(this.hillsNear, this.horizon, this.h * 0.045, lerpRgb(th.hills[0], th.skyDawn[0], lift * 0.4));
  }

  private drawWater(ctx: CanvasRenderingContext2D, p: number, rm: boolean) {
    const th = this.theme;
    const top = this.horizon;
    const g = ctx.createLinearGradient(0, top, 0, this.h);
    g.addColorStop(0, lerpRgb(th.water[0], th.skyDawn[0], p * 0.35));
    g.addColorStop(1, th.water[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, this.w, this.h - top);

    // Reflected orb / ring glow.
    if (this.mode !== 'pond') {
      const f = this.focus;
      const ry = top + (top - f.y) * 0.35;
      const rr = this.size * (0.08 + 0.1 * this.guide);
      const rg = ctx.createRadialGradient(f.x, ry, 0, f.x, ry, rr * 2.2);
      rg.addColorStop(0, hexA(th.accent, 0.18));
      rg.addColorStop(1, hexA(th.accent, 0));
      ctx.save();
      ctx.translate(f.x, ry);
      ctx.scale(1, 0.35);
      ctx.translate(-f.x, -ry);
      ctx.fillStyle = rg;
      ctx.fillRect(f.x - rr * 2.2, ry - rr * 2.2, rr * 4.4, rr * 4.4);
      ctx.restore();
    }

    ctx.strokeStyle = th.glow;
    ctx.lineWidth = 1;
    for (const s of this.shimmer) {
      const depth = (s.y - top) / (this.h - top);
      const a = (0.06 + 0.12 * (1 - depth)) * (rm ? 0.7 : 0.5 + 0.5 * Math.sin(this.t * 0.8 + s.phase));
      const drift = rm ? 0 : Math.sin(this.t * 0.2 + s.phase) * 12;
      ctx.globalAlpha = a * (0.6 + 0.4 * p);
      ctx.beginPath();
      ctx.moveTo(s.x + drift, s.y);
      ctx.lineTo(s.x + drift + s.len * (1 - depth * 0.5), s.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawTree(ctx: CanvasRenderingContext2D, rm: boolean) {
    if (this.growth < 0.002) return;
    const th = this.theme;
    const trunk = Math.min(this.h * 0.105, this.w * 0.15);
    const wind = rm ? 0 : 1;
    const t = this.t;
    const breath = this.guide;
    const segs = layoutTree(this.tree, {
      x: this.w / 2,
      y: this.horizon + 2,
      trunk,
      growth: this.growth,
      maxDepth: DEFAULT_TREE.depth,
      sway: (n) => wind * (0.012 + 0.004 * breath) * n.depth * Math.sin(t * 0.55 + n.swayPhase * 0.3 + n.depth * 0.4),
    });

    // Batch by depth: one path per generation keeps it cheap.
    const byDepth: (typeof segs)[] = [];
    for (const s of segs) (byDepth[s.depth] ??= []).push(s);
    ctx.lineCap = 'round';
    byDepth.forEach((list, depth) => {
      if (!list) return;
      const k = depth / DEFAULT_TREE.depth;
      ctx.strokeStyle = lerpRgb(th.hills[0], th.accent, 0.15 + 0.75 * k);
      ctx.globalAlpha = 0.95 - 0.35 * k;
      ctx.lineWidth = Math.max(0.6, trunk * 0.09 * 0.7 ** depth);
      ctx.beginPath();
      for (const s of list) {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Blossoms: each breath in harmony opens a few more.
    const tips = segs.filter((s) => s.tip && s.grown > 0.95);
    if (!tips.length || !this.sprite) return;
    const tipIndex = new Map<number, (typeof segs)[number]>();
    let ti = 0;
    for (const s of segs) if (s.tip) tipIndex.set(ti++, s);
    const open = Math.min(this.tipOrder.length, this.bloom * 6);
    ctx.globalCompositeOperation = 'lighter';
    const firstTip = this.tree.length - this.tipOrder.length;
    for (let i = 0; i < Math.ceil(open); i++) {
      const seg = tipIndex.get(this.tipOrder[i] - firstTip);
      if (!seg) continue;
      const scale = clamp(open - i, 0, 1);
      const size = 10 * easeOutCubic(scale) * (1 + 0.15 * Math.sin(t * 1.3 + i));
      ctx.globalAlpha = 0.75 * scale;
      drawTinted(ctx, this.sprite, seg.x2, seg.y2, size, i % 3 ? th.accent2 : th.glow);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private drawFireflies(ctx: CanvasRenderingContext2D, rm: boolean) {
    if (!this.sprite) return;
    const f = this.focus;
    const breathe = 1 + 0.05 * this.guide;
    ctx.globalCompositeOperation = 'lighter';
    for (const fl of this.fireflies) {
      const tt = rm ? 0 : this.t;
      let x = fl.bx + Math.sin(tt * fl.fx + fl.phase) * fl.ax + Math.sin(tt * fl.fx * 2.3 + fl.phase) * fl.ax * 0.3;
      let y = fl.by + Math.cos(tt * fl.fy + fl.phase) * fl.ay;
      // Everything breathes a little with the guide.
      x = f.x + (x - f.x) * breathe;
      y = f.y + (y - f.y) * breathe;
      ctx.globalAlpha = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(this.t * 0.9 + fl.phase * 3));
      drawTinted(ctx, this.sprite, x, y, fl.size, this.theme.accent2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private drawOrb(ctx: CanvasRenderingContext2D) {
    const th = this.theme;
    const { x, y } = this.focus;
    const m = this.size;
    const rMin = m * 0.05, rMax = m * 0.155;
    const gr = rMin + (rMax - rMin) * this.guide;
    const glow = this.harmonyGlow;

    const halo = ctx.createRadialGradient(x, y, gr * 0.3, x, y, gr * 2.1);
    halo.addColorStop(0, hexA(th.accent, 0.18 + 0.22 * glow));
    halo.addColorStop(1, hexA(th.accent, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, gr * 2.1, 0, TAU);
    ctx.fill();

    // Faint outer limit so you can see how far the breath will go.
    ctx.strokeStyle = hexA(th.glow, 0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, rMax, 0, TAU);
    ctx.stroke();

    if (this.player != null) {
      const pr = rMin + (rMax - rMin) * this.player;
      const fill = ctx.createRadialGradient(x, y, 0, x, y, pr);
      fill.addColorStop(0, hexA(th.accent2, 0.75));
      fill.addColorStop(1, hexA(th.accent2, 0.15 + 0.2 * glow));
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, pr, 0, TAU);
      ctx.fill();
    } else {
      const fill = ctx.createRadialGradient(x, y, 0, x, y, gr);
      fill.addColorStop(0, hexA(th.glow, 0.5));
      fill.addColorStop(1, hexA(th.accent, 0.12));
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, gr, 0, TAU);
      ctx.fill();
    }

    // The guide ring brightens when your light and the guide move together.
    ctx.strokeStyle = lerpRgb(th.accent, th.glow, glow);
    ctx.globalAlpha = 0.55 + 0.4 * glow;
    ctx.lineWidth = 2 + glow;
    ctx.beginPath();
    ctx.arc(x, y, gr, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private ringPoint(i: number, cx: number, cy: number, R: number, rot = 0, scale = 1) {
    const a = -Math.PI / 2 + (i / RING_SLOTS) * TAU + rot;
    return { x: cx + Math.cos(a) * R * scale, y: cy + Math.sin(a) * R * scale };
  }

  private drawRing(ctx: CanvasRenderingContext2D) {
    const th = this.theme;
    const { x, y } = this.focus;
    const R = this.size * 0.17;
    const lit = this.count;

    ctx.strokeStyle = hexA(th.glow, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();

    // Pressing-and-holding fills the circle towards closing it.
    if (this.holdProgress != null && this.holdProgress > 0) {
      ctx.strokeStyle = hexA(th.accent2, 0.8);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + TAU * this.holdProgress);
      ctx.stroke();
    }

    // Lines between lit stars, and the full shape for a moment after closing.
    const lineCount = this.closing > 0 ? RING_SLOTS : lit;
    if (lineCount > 1) {
      ctx.strokeStyle = hexA(th.accent, 0.35 * (this.closing > 0 ? this.closing : this.ringFade));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < lineCount; i++) {
        const pt = this.ringPoint(i, x, y, R);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      if (this.closing > 0) ctx.closePath();
      ctx.stroke();
    }

    for (let i = 0; i < RING_SLOTS; i++) {
      const pt = this.ringPoint(i, x, y, R);
      const on = i < lit || this.closing > 0;
      const pulse = this.ringPulse[i];
      if (on && this.sprite) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.85 + 0.15 * pulse) * (this.closing > 0 ? Math.max(this.closing, 0.3) : this.ringFade);
        drawTinted(ctx, this.sprite, pt.x, pt.y, 18 + 16 * pulse, i === RING_SLOTS - 1 ? th.accent2 : th.glow);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = on ? 1 : 0.35;
      ctx.fillStyle = on ? th.glow : th.muted;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, i === RING_SLOTS - 1 ? 3.4 : 2.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawConstellations(ctx: CanvasRenderingContext2D, dt: number) {
    if (!this.constellations.length) return;
    const th = this.theme;
    const R = this.size * 0.17;
    for (const c of this.constellations) {
      c.age += dt;
      const a = clamp(c.age / 2.5, 0, 1) * 0.5;
      ctx.globalAlpha = a;
      ctx.strokeStyle = th.accent;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i <= RING_SLOTS; i++) {
        const pt = this.ringPoint(i % RING_SLOTS, c.x, c.y, R, c.rot, c.scale);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.fillStyle = th.glow;
      for (let i = 0; i < RING_SLOTS; i++) {
        const pt = this.ringPoint(i, c.x, c.y, R, c.rot, c.scale);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawRipples(ctx: CanvasRenderingContext2D, dt: number) {
    const th = this.theme;
    ctx.lineWidth = 1.4;
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const life = 4.5;
      if (r.age > life) {
        this.ripples.splice(i, 1);
        continue;
      }
      for (let k = 0; k < 3; k++) {
        const age = r.age - k * 0.35;
        if (age <= 0) continue;
        const radius = easeOutCubic(Math.min(1, age / life)) * 220 * r.strength + 4;
        const alpha = (1 - age / life) * 0.55 * (1 - k * 0.25);
        if (alpha <= 0) continue;
        ctx.strokeStyle = hexA(k === 0 ? th.glow : th.accent, alpha);
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, radius, radius * 0.38, 0, 0, TAU);
        ctx.stroke();
      }
    }
  }

  private updateKoi(dt: number, rm: boolean) {
    const top = this.horizon + 30;
    const speedCap = rm ? 25 : 55;
    for (const k of this.koi) {
      k.wander += (this.rng() - 0.5) * dt * 1.5;
      k.vx += Math.cos(k.wander) * 14 * dt;
      k.vy += Math.sin(k.wander) * 6 * dt;
      // Stay in the water, gently.
      if (k.x < 30) k.vx += 30 * dt;
      if (k.x > this.w - 30) k.vx -= 30 * dt;
      if (k.y < top) k.vy += 30 * dt;
      if (k.y > this.h - 30) k.vy -= 30 * dt;
      const sp = Math.hypot(k.vx, k.vy);
      if (sp > speedCap) {
        k.vx *= speedCap / sp;
        k.vy *= speedCap / sp;
      }
      k.vx *= Math.exp(-0.3 * dt);
      k.vy *= Math.exp(-0.3 * dt);
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (sp > 2) k.heading = Math.atan2(k.vy, k.vx);
    }
  }

  private drawKoi(ctx: CanvasRenderingContext2D) {
    if (!this.sprite) return;
    const th = this.theme;
    for (const k of this.koi) {
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.heading);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      drawTinted(ctx, this.sprite, 0, 0, k.size * 2.2, th.accent2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = th.accent2;
      ctx.beginPath();
      ctx.ellipse(0, 0, k.size, k.size * 0.38, 0, 0, TAU);
      ctx.fill();
      const wag = Math.sin(this.t * 4 + k.wander) * 0.35;
      ctx.beginPath();
      ctx.moveTo(-k.size * 0.85, 0);
      ctx.lineTo(-k.size * 1.6, -k.size * 0.4 + wag * k.size * 0.4);
      ctx.lineTo(-k.size * 1.6, k.size * 0.4 + wag * k.size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp(a, 0, 1).toFixed(3)})`;
}

const tintCache = new Map<string, HTMLCanvasElement>();

/** White glow sprite recoloured once per color, then reused. */
function drawTinted(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number, size: number, color: string) {
  let tinted = tintCache.get(color);
  if (!tinted) {
    tinted = document.createElement('canvas');
    tinted.width = sprite.width;
    tinted.height = sprite.height;
    const c = tinted.getContext('2d');
    if (c) {
      c.drawImage(sprite, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = color;
      c.fillRect(0, 0, tinted.width, tinted.height);
    }
    tintCache.set(color, tinted);
  }
  ctx.drawImage(tinted, x - size, y - size, size * 2, size * 2);
}
