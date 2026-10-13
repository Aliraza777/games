import { TAU, clamp, lerp, type Vec } from '../lib/math';
import { INKS, type VehicleSpec } from './config';
import type { Game } from './Game';
import type { VehicleState } from './physics';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  shake: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

export interface BurstOpts {
  count: number;
  color: string;
  speed: number;
  life: number;
  angle?: number;
  spread?: number;
  size?: number;
  gravity?: number;
}

const MAX_PARTICLES = 600;

export class Particles {
  items: Particle[] = [];
  constructor(private reduced: boolean) {}

  burst(x: number, y: number, o: BurstOpts) {
    const n = this.reduced ? Math.min(4, o.count) : o.count;
    for (let i = 0; i < n && this.items.length < MAX_PARTICLES; i++) {
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? TAU);
      const sp = o.speed * (0.35 + Math.random() * 0.75);
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: o.life * (0.6 + Math.random() * 0.6),
        size: (o.size ?? 0.16) * (0.6 + Math.random() * 0.8),
        color: o.color,
        gravity: o.gravity ?? -9,
      });
    }
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.items[i] = this.items[this.items.length - 1];
        this.items.pop();
        continue;
      }
      p.vx *= Math.exp(-1.5 * dt);
      p.vy = p.vy * Math.exp(-1.5 * dt) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}

const SKY = ['#07021a', '#1a0838', '#3b0d58'];
const TERRAIN_EDGE = '#b18cff';

/**
 * Canvas 2D renderer. World units are meters (y up); everything glows with a
 * double-stroke (wide translucent + thin bright) instead of costly shadowBlur.
 */
export class Renderer {
  readonly particles: Particles;
  flash = 0;
  private ctx: CanvasRenderingContext2D | null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private sky: CanvasGradient | null = null;
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private reduced: boolean;
  /** Where the camera's focus point sits on screen (fractions of width/height). */
  anchor = { x: 0.5, y: 0.56 };

  constructor(
    private canvas: HTMLCanvasElement,
    opts: { reducedMotion: boolean },
  ) {
    this.reduced = opts.reducedMotion;
    this.particles = new Particles(opts.reducedMotion);
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    this.ctx = ctx;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth || 1280;
    this.h = this.canvas.clientHeight || 720;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    if (!this.ctx) return;
    this.sky = this.ctx.createLinearGradient(0, 0, 0, this.h);
    this.sky.addColorStop(0, SKY[0]);
    this.sky.addColorStop(0.55, SKY[1]);
    this.sky.addColorStop(1, SKY[2]);
    this.stars = Array.from({ length: 90 }, (_, i) => ({
      x: ((i * 7919) % 1000) / 1000,
      y: ((i * 104729) % 1000) / 1000 * 0.55,
      r: 0.5 + ((i * 31) % 10) / 10,
      p: i,
    }));
  }

  /** Pixels per meter. */
  scale(cam: Camera) {
    return clamp(Math.min(this.w / 38, this.h / 21), 14, 44) * cam.zoom;
  }

  metersAcross(cam: Camera) {
    return this.w / this.scale(cam);
  }

  worldToScreen(p: Vec, cam: Camera): Vec {
    const s = this.scale(cam);
    return { x: (p.x - cam.x) * s + this.w * this.anchor.x, y: this.h * this.anchor.y - (p.y - cam.y) * s };
  }

  screenToWorld(p: Vec, cam: Camera): Vec {
    const s = this.scale(cam);
    return { x: (p.x - this.w * this.anchor.x) / s + cam.x, y: (this.h * this.anchor.y - p.y) / s + cam.y };
  }

  draw(g: Game, dt: number) {
    this.particles.update(dt * (g.state === 'paused' ? 0 : 1));
    const ctx = this.ctx;
    if (!ctx) return;
    const cam = g.camera;
    const s = this.scale(cam);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.drawBackdrop(ctx, cam, g.time);

    // World transform (with shake).
    const shake = cam.shake * cam.shake * 10;
    const ox = (Math.random() - 0.5) * shake, oy = (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(this.w * this.anchor.x + ox, this.h * this.anchor.y + oy);
    ctx.scale(s, -s);
    ctx.translate(-cam.x, -cam.y);
    const view = { x0: cam.x - (this.w * this.anchor.x) / s - 4, x1: cam.x + (this.w * (1 - this.anchor.x)) / s + 4 };

    for (const u of g.updrafts) if (u.x1 > view.x0 && u.x0 < view.x1) this.drawUpdraft(ctx, u, g.time, s);
    for (const p of g.platforms) if (p.x1 > view.x0 && p.x0 < view.x1) this.drawPlatform(ctx, p.points, s);
    const ghost = g.ghostGap;
    if (ghost) this.drawGhost(ctx, ghost.from, ghost.to, g.time, s);
    for (const st of g.strokes.values()) this.drawStroke(ctx, st.points, st.kind, g.time, s);
    const live = g.drawingStroke;
    if (live && live.points.length > 1) this.drawStroke(ctx, live.points, live.kind, g.time, s, true);
    for (const p of g.pickups) if (!p.taken && p.x > view.x0 && p.x < view.x1) this.drawPickup(ctx, p.kind, p.x, p.y, g.time, s);
    if (g.state !== 'crashing' || g.vehicle().y > -1000) this.drawVehicle(ctx, g.spec, g.vehicle(), s, g.state === 'crashing');
    this.drawParticles(ctx, s);
    ctx.restore();

    const v = g.vehicle();
    if (!this.reduced) this.drawSpeedLines(ctx, Math.abs(v.vx), g.time);
    if (g.focusActive) this.drawFocus(ctx);
    const ptr = g.pointer;
    if (ptr) this.drawCursor(ctx, ptr, g);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flash * 0.6).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.flash = Math.max(0, this.flash - dt * 3);
    }
  }

  // ─── backdrop ─────────────────────────────────────────────────────────────

  private drawBackdrop(ctx: CanvasRenderingContext2D, cam: Camera, t: number) {
    const { w, h } = this;
    ctx.fillStyle = this.sky ?? SKY[1];
    ctx.fillRect(0, 0, w, h);

    for (const st of this.stars) {
      const x = ((st.x * w - cam.x * 2) % w + w) % w;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + st.p);
      ctx.fillStyle = '#e8dcff';
      ctx.fillRect(x, st.y * h, st.r, st.r);
    }
    ctx.globalAlpha = 1;

    // Synthwave sun with stripes.
    const horizon = h * 0.64;
    const r = Math.min(w, h) * 0.2;
    // The sun stays put — like the real one, it's too far away to scroll.
    const sx = w * 0.7;
    const sy = horizon - r * 0.35;
    const sun = ctx.createLinearGradient(0, sy - r, 0, sy + r);
    sun.addColorStop(0, '#ffe066');
    sun.addColorStop(0.55, '#ff7a59');
    sun.addColorStop(1, '#ff2fa8');
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = sun;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    ctx.fillStyle = SKY[2];
    for (let i = 0; i < 7; i++) {
      const y = sy + r * (0.05 + i * 0.14);
      ctx.fillRect(sx - r, y, r * 2, 2 + i * 1.6);
    }
    ctx.restore();
    const halo = ctx.createRadialGradient(sx, sy, r * 0.8, sx, sy, r * 2.2);
    halo.addColorStop(0, 'rgba(255,79,216,0.22)');
    halo.addColorStop(1, 'rgba(255,79,216,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - r * 2.2, sy - r * 2.2, r * 4.4, r * 4.4);

    // Two parallax mountain ridges.
    this.ridge(ctx, cam.x * 6, horizon, h * 0.16, '#160733', 'rgba(255,79,216,0.45)', 0.004, 1);
    this.ridge(ctx, cam.x * 14, horizon + h * 0.02, h * 0.1, '#0e0424', 'rgba(70,240,255,0.35)', 0.007, 2);

    // Perspective grid over the void.
    ctx.fillStyle = '#07021a';
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.strokeStyle = 'rgba(255,79,216,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const scroll = (cam.x * 1.6) % 1;
    for (let i = 0; i < 14; i++) {
      const k = (i + 1 - scroll) / 14;
      const y = horizon + (h - horizon) * k * k;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    const vx = w / 2;
    const off = ((cam.x * 30) % 80);
    for (let x = -w; x < w * 2; x += 80) {
      ctx.moveTo(vx + (x - off - vx) * 0.08, horizon);
      ctx.lineTo(x - off, h);
    }
    ctx.stroke();
  }

  private ridge(ctx: CanvasRenderingContext2D, offset: number, base: number, amp: number, fill: string, edge: string, freq: number, seed: number) {
    const { w } = this;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= w + 20; x += 20) {
      const u = (x + offset) * freq;
      const y = base - amp * (0.55 + 0.3 * Math.sin(u + seed) + 0.15 * Math.sin(u * 2.7 + seed * 3) + 0.1 * Math.sin(u * 6.1));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, base);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ─── world ────────────────────────────────────────────────────────────────

  private drawPlatform(ctx: CanvasRenderingContext2D, pts: Vec[], s: number) {
    const first = pts[0], last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.moveTo(first.x, first.y - 40);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(last.x, last.y - 40);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, first.y, 0, first.y - 14);
    g.addColorStop(0, '#24104d');
    g.addColorStop(1, '#09031a');
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(first.x, first.y - 2.5);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(last.x, last.y - 2.5);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = TERRAIN_EDGE;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 9 / s;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.2 / s;
    ctx.strokeStyle = '#d6c6ff';
    ctx.stroke();
  }

  private drawStroke(ctx: CanvasRenderingContext2D, pts: Vec[], kind: keyof typeof INKS, t: number, s: number, live = false) {
    if (pts.length < 2) return;
    const ink = INKS[kind];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = ink.color;
    const pulse = kind === 'bounce' && !this.reduced ? 1 + 0.3 * Math.sin(t * 8) : 1;
    ctx.globalAlpha = live ? 0.32 : 0.22;
    ctx.lineWidth = (live ? 0.75 : 0.6) * pulse;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(0.16, 3 / s);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    if (kind === 'boost') {
      // Chevrons racing forward along the strip.
      ctx.setLineDash([0.4, 0.8]);
      ctx.lineDashOffset = this.reduced ? 0 : -t * 6 * (pts[pts.length - 1].x >= pts[0].x ? 1 : -1);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(0.08, 1.5 / s);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawGhost(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, t: number, s: number) {
    ctx.setLineDash([0.5, 0.45]);
    ctx.lineDashOffset = -t * 2;
    ctx.strokeStyle = `rgba(255,255,255,${(0.45 + 0.35 * Math.sin(t * 4)).toFixed(3)})`;
    ctx.lineWidth = 3 / s;
    ctx.beginPath();
    ctx.moveTo(a.x - 1.2, a.y + 0.15);
    ctx.lineTo(b.x + 1.2, b.y + 0.15);
    ctx.stroke();
    ctx.setLineDash([]);
    // Animated pen tip sweeping across.
    const k = (t * 0.6) % 1;
    const px = lerp(a.x - 1.2, b.x + 1.2, k), py = lerp(a.y, b.y, k) + 0.15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 0.22, 0, TAU);
    ctx.fill();
  }

  private drawPickup(ctx: CanvasRenderingContext2D, kind: 'ink' | 'star', x: number, y: number, t: number, s: number) {
    const bob = this.reduced ? 0 : Math.sin(t * 3 + x) * 0.15;
    ctx.save();
    ctx.translate(x, y + bob);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.4);
    const c = kind === 'ink' ? '70,240,255' : '255,210,63';
    glow.addColorStop(0, `rgba(${c},0.55)`);
    glow.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
    if (kind === 'ink') {
      ctx.beginPath();
      ctx.moveTo(0, 0.55);
      ctx.bezierCurveTo(0.45, 0.05, 0.42, -0.45, 0, -0.45);
      ctx.bezierCurveTo(-0.42, -0.45, -0.45, 0.05, 0, 0.55);
      ctx.fillStyle = '#46f0ff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / s;
      ctx.stroke();
    } else {
      ctx.rotate(this.reduced ? 0 : t * 1.5);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.22 : 0.55;
        const a = (i / 10) * TAU + Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
    }
    ctx.restore();
  }

  private drawUpdraft(ctx: CanvasRenderingContext2D, u: { x0: number; x1: number; y0: number; y1: number }, t: number, s: number) {
    const g = ctx.createLinearGradient(0, u.y0, 0, u.y1);
    g.addColorStop(0, 'rgba(70,240,255,0)');
    g.addColorStop(0.7, 'rgba(70,240,255,0.10)');
    g.addColorStop(1, 'rgba(70,240,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(u.x0, u.y0, u.x1 - u.x0, u.y1 - u.y0);
    ctx.strokeStyle = 'rgba(70,240,255,0.45)';
    ctx.lineWidth = 2 / s;
    const span = u.y1 - u.y0;
    for (let i = 0; i < 6; i++) {
      const y = u.y0 + ((t * 6 + i * (span / 6)) % span);
      const x = lerp(u.x0, u.x1, (i * 0.37) % 1);
      ctx.beginPath();
      ctx.moveTo(x - 0.4, y - 0.3);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 0.4, y - 0.3);
      ctx.stroke();
    }
  }

  // ─── vehicle ──────────────────────────────────────────────────────────────

  private drawVehicle(ctx: CanvasRenderingContext2D, spec: VehicleSpec, v: VehicleState, s: number, crashed: boolean) {
    const line = 2.2 / s;
    // Wheels first so the body sits on top.
    for (const w of v.wheels) this.drawWheel(ctx, w.x, w.y, w.angle, spec.wheel.r, spec.color, s);

    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    const { w: cw, h: ch } = spec.chassis;
    const color = crashed ? '#ff4f6d' : spec.color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = line;

    if (!crashed && !this.reduced) {
      // Headlight cone.
      const hl = ctx.createLinearGradient(cw / 2, 0, cw / 2 + 7, 0);
      hl.addColorStop(0, 'rgba(255,255,220,0.35)');
      hl.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.moveTo(cw / 2, 0.05);
      ctx.lineTo(cw / 2 + 7, 1.2);
      ctx.lineTo(cw / 2 + 7, -1.4);
      ctx.closePath();
      ctx.fill();
    }

    if (spec.id === 'bike') {
      const [rx, fx] = spec.wheel.x;
      const wy = spec.wheel.y;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(rx, wy);
      ctx.lineTo(-0.15, 0.25);
      ctx.lineTo(0.55, 0.45);
      ctx.lineTo(fx, wy);
      ctx.moveTo(-0.15, 0.25);
      ctx.lineTo(0.25, -0.2);
      ctx.lineTo(rx, wy);
      ctx.stroke();
      ctx.fillStyle = '#140a2c';
      ctx.fillRect(-0.3, -0.25, 0.7, 0.4);
      ctx.strokeRect(-0.3, -0.25, 0.7, 0.4);
      // Rider.
      ctx.strokeStyle = '#f2ecff';
      ctx.lineWidth = line * 1.4;
      ctx.beginPath();
      ctx.moveTo(-0.15, 0.3);
      ctx.lineTo(0.05, 0.95);
      ctx.lineTo(0.5, 0.55);
      ctx.moveTo(-0.15, 0.3);
      ctx.lineTo(0.25, 0.05);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(spec.head.x, spec.head.y, spec.head.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,10,44,0.9)';
      ctx.fillRect(spec.head.x + 0.02, spec.head.y - 0.05, spec.head.r * 0.9, 0.14);
    } else {
      const truck = spec.id === 'truck';
      ctx.fillStyle = '#140a2c';
      ctx.strokeStyle = color;
      // Body.
      ctx.beginPath();
      ctx.moveTo(-cw / 2, -ch / 2);
      ctx.lineTo(cw / 2, -ch / 2);
      ctx.lineTo(cw / 2, ch * 0.15);
      ctx.lineTo(cw * 0.3, ch / 2);
      ctx.lineTo(-cw / 2, ch / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Cabin.
      ctx.beginPath();
      ctx.moveTo(-cw * 0.3, ch / 2);
      ctx.lineTo(cw * 0.25, ch / 2);
      ctx.lineTo(cw * 0.12, ch / 2 + (truck ? 0.5 : 0.35));
      ctx.lineTo(-cw * 0.22, ch / 2 + (truck ? 0.5 : 0.35));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(70,240,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(-cw * 0.03, ch / 2 + 0.06);
      ctx.lineTo(cw * 0.2, ch / 2 + 0.06);
      ctx.lineTo(cw * 0.1, ch / 2 + (truck ? 0.42 : 0.28));
      ctx.lineTo(-cw * 0.03, ch / 2 + (truck ? 0.42 : 0.28));
      ctx.closePath();
      ctx.fill();
      // Neon underglow stripe + lights.
      ctx.strokeStyle = 'rgba(255,79,216,0.8)';
      ctx.beginPath();
      ctx.moveTo(-cw / 2 + 0.2, -ch / 2 + 0.12);
      ctx.lineTo(cw / 2 - 0.2, -ch / 2 + 0.12);
      ctx.stroke();
      ctx.fillStyle = '#fff6c4';
      ctx.fillRect(cw / 2 - 0.12, -0.05, 0.12, 0.16);
      ctx.fillStyle = '#ff3355';
      ctx.fillRect(-cw / 2, -0.05, 0.1, 0.16);
      if (truck) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(-cw * 0.45, ch / 2);
        ctx.lineTo(-cw * 0.45, ch / 2 + 0.35);
        ctx.lineTo(-cw * 0.22, ch / 2 + 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, r: number, color: string, s: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#0b0618';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(r * 0.22, 2 / s);
    ctx.strokeStyle = '#ece6ff';
    ctx.stroke();
    ctx.lineWidth = 2 / s;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, TAU);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, s: number) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles.items) {
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      const size = Math.max(p.size * (0.5 + k * 0.5), 1.5 / s);
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ─── screen-space overlays ───────────────────────────────────────────────

  private drawSpeedLines(ctx: CanvasRenderingContext2D, speed: number, t: number) {
    const k = clamp((speed - 14) / 12, 0, 1);
    if (k <= 0) return;
    ctx.strokeStyle = `rgba(232,220,255,${(0.25 * k).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const y = ((i * 97.3 + t * 13) % 1) * this.h;
      const x = this.w - (((i * 271 + t * 2400) % (this.w * 1.5)));
      ctx.moveTo(x, y);
      ctx.lineTo(x + 60 + 80 * k, y);
    }
    ctx.stroke();
  }

  private drawFocus(ctx: CanvasRenderingContext2D) {
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.25, this.w / 2, this.h / 2, this.h * 0.9);
    g.addColorStop(0, 'rgba(70,240,255,0)');
    g.addColorStop(1, 'rgba(70,240,255,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawCursor(ctx: CanvasRenderingContext2D, p: { x: number; y: number; drawing: boolean }, g: Game) {
    const ink = INKS[g.inkKind];
    const ok = g.canDrawHere && g.tank.level > 0;
    const r = p.drawing ? 15 : 13;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = ok ? ink.color : '#ff4f6d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(g.tank.level / g.tank.max, 0, 1));
    ctx.stroke();
    ctx.fillStyle = ok ? ink.color : '#ff4f6d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.drawing ? 4 : 3, 0, TAU);
    ctx.fill();
    if (!ok) {
      ctx.strokeStyle = '#ff4f6d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y - 6);
      ctx.lineTo(p.x + 6, p.y + 6);
      ctx.stroke();
    }
  }
}
