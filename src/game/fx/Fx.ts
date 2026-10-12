import { BitmapText, Container, Sprite } from 'pixi.js';
import { RING_RADIUS, type FxTextures } from '../engine/textures';
import { TAU, easeOutBack, easeOutCubic, lerp } from '../../lib/math';

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  drag: number;
  gravity: number;
  spin: number;
  size: number;
  kind: ParticleTexture;
}

interface Ring {
  s: Sprite;
  life: number;
  max: number;
  from: number;
  to: number;
  alpha: number;
}

interface Floater {
  t: BitmapText;
  life: number;
  max: number;
  x: number;
  y: number;
  rise: number;
  scale: number;
}

type ParticleTexture = 'dot' | 'petal' | 'spark';

export interface BurstOpts {
  count: number;
  color: number;
  speed: number;
  size?: number;
  life?: number;
  texture?: ParticleTexture;
  /** Spread in radians around `angle` (default: full circle). */
  spread?: number;
  angle?: number;
  gravity?: number;
  drag?: number;
  /** Spawn on a ring of this radius instead of a point. */
  radius?: number;
}

const MAX_PARTICLES = 700;
export const FONT_FAMILY = 'Space Grotesk, Inter, system-ui, sans-serif';

/** Pooled particles, ripples and floating text. Nothing allocates once warm. */
export class Fx {
  readonly particleLayer = new Container();
  readonly ringLayer = new Container();
  readonly textLayer = new Container();
  /** 0..1 multiplier; the engine lowers it when frames get slow. */
  budget = 1;

  private particles: Particle[] = [];
  private spritePool: Sprite[] = [];
  private rings: Ring[] = [];
  private ringPool: Sprite[] = [];
  private floaters: Floater[] = [];
  private textPool: BitmapText[] = [];

  constructor(
    private tex: FxTextures,
    private opts: { reducedMotion: boolean; clean: boolean },
  ) {}

  burst(x: number, y: number, o: BurstOpts) {
    let n = Math.round(o.count * this.budget * (this.opts.clean ? 0.45 : 1));
    if (this.opts.reducedMotion) n = Math.min(n, 4);
    const kind = o.texture ?? 'dot';
    const speedScale = this.opts.reducedMotion ? 0.4 : 1;
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const s = this.spritePool.pop() ?? this.newSprite(this.particleLayer);
      s.texture = this.tex[kind];
      s.tint = o.color;
      s.visible = true;
      s.alpha = 1;
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? TAU);
      const sp = o.speed * (0.45 + Math.random() * 0.75) * speedScale;
      const r0 = (o.radius ?? 0) * 0.6;
      s.position.set(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      s.rotation = kind === 'spark' ? a : Math.random() * TAU;
      this.particles.push({
        s,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: (o.life ?? 0.5) * (0.7 + Math.random() * 0.6),
        drag: o.drag ?? 4,
        gravity: o.gravity ?? 0,
        spin: kind === 'petal' ? (Math.random() - 0.5) * 12 : 0,
        size: (o.size ?? 8) * (0.6 + Math.random() * 0.8),
        kind,
      });
    }
  }

  ripple(x: number, y: number, o: { color: number; from: number; to: number; life?: number; alpha?: number }) {
    const s = this.ringPool.pop() ?? this.newSprite(this.ringLayer, this.tex.ring);
    s.visible = true;
    s.tint = o.color;
    s.position.set(x, y);
    s.scale.set(o.from / RING_RADIUS);
    this.rings.push({ s, life: 0, max: o.life ?? 0.35, from: o.from, to: o.to, alpha: o.alpha ?? 0.9 });
  }

  floater(x: number, y: number, text: string, o: { color: number; size?: number; rise?: number; life?: number }) {
    const t =
      this.textPool.pop() ??
      (() => {
        const bt = new BitmapText({
          text: '',
          style: { fontFamily: FONT_FAMILY, fontSize: 64, fill: 0xffffff, fontWeight: 'bold' },
        });
        bt.anchor.set(0.5);
        this.textLayer.addChild(bt);
        return bt;
      })();
    t.text = text;
    t.tint = o.color;
    t.visible = true;
    t.position.set(x, y);
    this.floaters.push({
      t,
      life: 0,
      max: o.life ?? 0.7,
      x,
      y,
      rise: this.opts.reducedMotion ? 0 : (o.rise ?? 42),
      scale: (o.size ?? 22) / 64,
    });
  }

  update(dt: number) {
    if (dt <= 0) return;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        p.s.visible = false;
        this.spritePool.push(p.s);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      const size = p.size * (1 - easeOutCubic(t) * 0.85);
      if (p.kind === 'spark') {
        const speed = Math.hypot(p.vx, p.vy);
        p.s.width = size * (1.5 + speed / 120);
        p.s.height = size * 0.45;
        p.s.rotation = Math.atan2(p.vy, p.vx);
      } else if (p.kind === 'petal') {
        p.s.width = size * 0.7;
        p.s.height = size;
        p.s.rotation += p.spin * dt;
      } else {
        p.s.width = p.s.height = size;
      }
      p.s.alpha = 1 - t * t;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const t = r.life / r.max;
      if (t >= 1) {
        r.s.visible = false;
        this.ringPool.push(r.s);
        this.rings.splice(i, 1);
        continue;
      }
      r.s.scale.set(lerp(r.from, r.to, easeOutCubic(t)) / RING_RADIUS);
      r.s.alpha = r.alpha * (1 - t);
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life += dt;
      const t = f.life / f.max;
      if (t >= 1) {
        f.t.visible = false;
        this.textPool.push(f.t);
        this.floaters.splice(i, 1);
        continue;
      }
      const pop = this.opts.reducedMotion ? 1 : easeOutBack(Math.min(t / 0.25, 1), 2.2);
      f.t.scale.set(f.scale * (0.6 + 0.4 * pop));
      f.t.y = f.y - f.rise * easeOutCubic(t);
      f.t.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    }
  }

  private newSprite(layer: Container, texture = this.tex.dot): Sprite {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    layer.addChild(s);
    return s;
  }
}
