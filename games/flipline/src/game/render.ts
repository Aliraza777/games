import { TAU, clamp, type Vec } from '../lib/math';
import { BIKE, type BikeSkin } from './config';
import type { Camera, Game } from './Game';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

interface Ring {
  x: number;
  y: number;
  age: number;
  color: string;
}

export class Particles {
  items: Particle[] = [];
  constructor(private reduced: boolean) {}
  burst(x: number, y: number, o: { count: number; color: string; speed: number; life: number; angle?: number; spread?: number; size?: number }) {
    const n = this.reduced ? Math.min(4, o.count) : o.count;
    for (let i = 0; i < n && this.items.length < 500; i++) {
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? TAU);
      const sp = o.speed * (0.35 + Math.random() * 0.75);
      this.items.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: o.life * (0.6 + Math.random() * 0.6), size: (o.size ?? 0.14) * (0.6 + Math.random()), color: o.color });
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
      p.vy -= 12 * dt;
      p.vx *= Math.exp(-1.2 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}

/**
 * Neon-on-black renderer. Glow is a cheap double stroke (wide translucent +
 * thin bright core). World units are meters, y up.
 */
export class Renderer {
  readonly particles: Particles;
  flash = 0;
  private ctx: CanvasRenderingContext2D | null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private trail: Vec[] = [];
  private rings: Ring[] = [];
  private reduced: boolean;
  private color: string;
  private glow: string;
  private skin: BikeSkin;
  /** Screen height fraction where the camera focus sits (lower on the title screen). */
  anchorY = 0.58;

  constructor(
    private canvas: HTMLCanvasElement,
    o: { reducedMotion: boolean; color: string; glow: string; skin: BikeSkin },
  ) {
    this.reduced = o.reducedMotion;
    this.color = o.color;
    this.glow = o.glow;
    this.skin = o.skin;
    this.particles = new Particles(o.reducedMotion);
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
    this.stars = Array.from({ length: 110 }, (_, i) => ({
      x: ((i * 7919) % 997) / 997,
      y: ((i * 104729) % 991) / 991,
      r: 0.5 + ((i * 37) % 10) / 9,
      p: i,
    }));
  }

  scale(cam: Camera) {
    return clamp(Math.min(this.w / 28, this.h / 15), 16, 50) * cam.zoom;
  }

  metersAcross(cam: Camera) {
    return this.w / this.scale(cam);
  }

  worldToScreen(p: Vec, cam: Camera): Vec {
    const s = this.scale(cam);
    return { x: (p.x - cam.x) * s + this.w / 2, y: this.h * this.anchorY - (p.y - cam.y) * s };
  }

  clearTrail() {
    this.trail = [];
  }

  ring(x: number, y: number, color: string) {
    if (!this.reduced) this.rings.push({ x, y, age: 0, color });
  }

  draw(g: Game, dt: number) {
    this.particles.update(g.state === 'paused' ? 0 : dt);
    const ctx = this.ctx;
    if (!ctx) return;
    const cam = g.camera;
    const s = this.scale(cam);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.backdrop(ctx, cam, g.clock);

    const shake = cam.shake * cam.shake * 9;
    ctx.save();
    ctx.translate(this.w / 2 + (Math.random() - 0.5) * shake, this.h * this.anchorY + (Math.random() - 0.5) * shake);
    ctx.scale(s, -s);
    ctx.translate(-cam.x, -cam.y);
    const x0 = cam.x - this.w / 2 / s - 3, x1 = cam.x + this.w / 2 / s + 3;

    // Track: soft fill below each line, then a glowing edge.
    for (const line of g.level.lines) {
      if (line[line.length - 1].x < x0 || line[0].x > x1) continue;
      this.fillBelow(ctx, line, g.level.floor);
    }
    for (const line of g.level.lines) {
      if (line[line.length - 1].x < x0 || line[0].x > x1) continue;
      this.glowPath(ctx, s, () => {
        ctx.moveTo(line[0].x, line[0].y);
        for (const p of line) ctx.lineTo(p.x, p.y);
        // Short drop-off edges at gaps make the lips readable.
        ctx.lineTo(line[line.length - 1].x, line[line.length - 1].y - 1.2);
      });
    }
    for (const l of g.physics.loops) {
      if (l.cx + l.r < x0 || l.cx - l.r > x1) continue;
      ctx.globalAlpha = l.done ? 0.45 : 1;
      this.glowPath(ctx, s, () => ctx.arc(l.cx, l.cy, l.r, 0, TAU));
      ctx.globalAlpha = 1;
    }

    this.checkpoints(ctx, g, s);
    this.finishGate(ctx, g, s);
    this.gems(ctx, g, s);
    this.bikeTrail(ctx, g, s);
    if (g.state !== 'crashed' || g.clock % 0.2 < 0.14) this.bike(ctx, g, s);
    this.drawParticles(ctx, s, dt);
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flash * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.flash = Math.max(0, this.flash - dt * 3);
    }
  }

  private backdrop(ctx: CanvasRenderingContext2D, cam: Camera, t: number) {
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#000000');
    g.addColorStop(1, this.glow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.fillStyle = '#ffffff';
    for (const st of this.stars) {
      const x = (((st.x * this.w - cam.x * 3) % this.w) + this.w) % this.w;
      ctx.globalAlpha = (this.reduced ? 0.5 : 0.3 + 0.3 * Math.sin(t * 1.5 + st.p)) * (1 - st.y * 0.6);
      ctx.fillRect(x, st.y * this.h * 0.8, st.r, st.r);
    }
    ctx.globalAlpha = 1;
  }

  private fillBelow(ctx: CanvasRenderingContext2D, line: Vec[], floor: number) {
    const bottom = floor - 30;
    ctx.beginPath();
    ctx.moveTo(line[0].x, bottom);
    for (const p of line) ctx.lineTo(p.x, p.y);
    ctx.lineTo(line[line.length - 1].x, bottom);
    ctx.closePath();
    const top = Math.max(...line.map((p) => p.y));
    const gr = ctx.createLinearGradient(0, top, 0, top - 12);
    gr.addColorStop(0, hexA(this.color, 0.16));
    gr.addColorStop(1, hexA(this.color, 0));
    ctx.fillStyle = gr;
    ctx.fill();
  }

  private glowPath(ctx: CanvasRenderingContext2D, s: number, path: () => void) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    path();
    ctx.strokeStyle = this.color;
    ctx.globalCompositeOperation = 'lighter';
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.22;
    ctx.lineWidth = 0.55;
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.lineWidth = Math.max(0.09, 3 / s);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  private checkpoints(ctx: CanvasRenderingContext2D, g: Game, s: number) {
    g.level.checkpoints.forEach((cp, i) => {
      if (i === 0) return;
      const lit = i <= g.checkpoint;
      ctx.strokeStyle = lit ? this.color : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2.5 / s;
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y);
      ctx.lineTo(cp.x, cp.y + 3);
      ctx.stroke();
      const wave = this.reduced ? 0 : Math.sin(g.clock * 6 + i) * 0.12;
      ctx.fillStyle = lit ? this.color : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y + 3);
      ctx.lineTo(cp.x + 1.3, cp.y + 2.6 + wave);
      ctx.lineTo(cp.x, cp.y + 2.2);
      ctx.closePath();
      ctx.fill();
    });
  }

  private finishGate(ctx: CanvasRenderingContext2D, g: Game, s: number) {
    const x = g.level.finishX;
    const line = g.level.lines[g.level.lines.length - 1];
    const ground = line.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best), line[0]).y;
    ctx.lineWidth = 3 / s;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.lineTo(x, ground + 5);
    ctx.moveTo(x + 0.4, ground);
    ctx.lineTo(x + 0.4, ground + 5);
    ctx.stroke();
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#ffffff' : '#111111';
        ctx.fillRect(x + 0.4 + c * 0.45, ground + 5 - r * 0.45, 0.45, -0.45);
      }
    }
  }

  private gems(ctx: CanvasRenderingContext2D, g: Game, s: number) {
    g.level.gems.forEach((gem, i) => {
      if (g.collected.has(i)) return;
      const spin = this.reduced ? 1 : Math.cos(g.clock * 3 + i);
      const bob = this.reduced ? 0 : Math.sin(g.clock * 2.4 + i) * 0.12;
      ctx.save();
      ctx.translate(gem.x, gem.y + bob);
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.1);
      gl.addColorStop(0, hexA(this.skin.accent, 0.5));
      gl.addColorStop(1, hexA(this.skin.accent, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
      ctx.scale(Math.max(0.15, Math.abs(spin)), 1);
      ctx.beginPath();
      ctx.moveTo(0, 0.45);
      ctx.lineTo(0.32, 0);
      ctx.lineTo(0, -0.45);
      ctx.lineTo(-0.32, 0);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = this.skin.accent;
      ctx.lineWidth = 2 / s;
      ctx.stroke();
      ctx.restore();
    });
  }

  private bikeTrail(ctx: CanvasRenderingContext2D, g: Game, s: number) {
    const w = g.bike.wheels[0];
    if (g.state === 'riding' && !this.reduced) {
      this.trail.push({ x: w.x, y: w.y });
      if (this.trail.length > 26) this.trail.shift();
    } else if (g.state !== 'paused' && this.trail.length) this.trail.shift();
    const n = this.trail.length;
    if (n < 2) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const t = i / n;
      ctx.strokeStyle = this.skin.trail === 'rainbow' ? `hsl(${(g.clock * 200 + i * 14) % 360} 100% 60%)` : this.skin.trail;
      ctx.globalAlpha = t * 0.55;
      ctx.lineWidth = Math.max(1 / s, 0.32 * t);
      ctx.beginPath();
      ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
      ctx.lineTo(this.trail[i].x, this.trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private bike(ctx: CanvasRenderingContext2D, g: Game, s: number) {
    const b = g.bike;
    const skin = this.skin;
    const line = 2.4 / s;
    for (const w of b.wheels) {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.angle);
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(0, 0, BIKE.wheel.r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = Math.max(0.09, 3 / s);
      ctx.strokeStyle = skin.body;
      ctx.stroke();
      ctx.lineWidth = line * 0.7;
      ctx.strokeStyle = skin.accent;
      ctx.beginPath();
      for (let i = 0; i < skin.spokes; i++) {
        const a = (i / skin.spokes) * TAU;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * BIKE.wheel.r * 0.8, Math.sin(a) * BIKE.wheel.r * 0.8);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    const [rx, fx] = BIKE.wheel.x;
    const wy = BIKE.wheel.y;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Frame.
    ctx.strokeStyle = skin.body;
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.moveTo(rx, wy);
    ctx.lineTo(-0.25, 0.12);
    ctx.lineTo(0.45, 0.2);
    ctx.lineTo(fx, wy);
    ctx.moveTo(0.45, 0.2);
    ctx.lineTo(0.62, 0.55);
    ctx.moveTo(-0.25, 0.12);
    ctx.lineTo(0.2, -0.18);
    ctx.lineTo(rx, wy);
    ctx.stroke();
    ctx.fillStyle = skin.accent;
    ctx.beginPath();
    ctx.moveTo(-0.5, 0.18);
    ctx.lineTo(0.15, 0.22);
    ctx.lineTo(0.05, 0.02);
    ctx.lineTo(-0.45, 0.04);
    ctx.closePath();
    ctx.fill();
    // Rider.
    const head = BIKE.head;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = line * 1.4;
    ctx.beginPath();
    ctx.moveTo(-0.15, 0.25);
    ctx.lineTo(0.0, 0.88);
    ctx.lineTo(0.6, 0.55);
    ctx.moveTo(-0.15, 0.25);
    ctx.lineTo(0.22, -0.02);
    ctx.stroke();
    ctx.fillStyle = skin.accent;
    ctx.beginPath();
    ctx.arc(head.x, head.y, head.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(head.x + 0.02, head.y - 0.04, head.r * 0.95, 0.13);
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, s: number, dt: number) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles.items) {
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.color;
      const sz = Math.max(p.size, 1.5 / s);
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age > 0.5) {
        this.rings.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - r.age / 0.5;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 / s;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 0.8 + r.age * 8, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
