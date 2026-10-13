import { Container, Graphics, Sprite } from 'pixi.js';
import type { FxTextures } from '../engine/textures';
import type { Palette } from '../../theme/palettes';
import { clamp, damp, lerpColor } from '../../lib/math';

interface Blob {
  s: Sprite;
  fx: number;
  fy: number;
  phase: number;
  speed: number;
  size: number;
  from: number;
  to: number;
}

/**
 * The living backdrop: drifting color blobs that warm up with the combo,
 * a dot grid that pulses on hits, and an edge glow for Overdrive.
 */
export class Background {
  readonly view = new Container();
  /** Freeze the "breathing" — Reflex uses this as the go signal. */
  frozen = false;

  private grid = new Graphics();
  private blobs: Blob[] = [];
  private vignette: Sprite;
  private edge: Sprite;
  private w = 0;
  private h = 0;
  private t = 0;
  private warmth = 0;
  private warmthTarget = 0;
  private overdrive = 0;
  private overdriveTarget = 0;
  private pulseV = 0;

  constructor(
    tex: FxTextures,
    private palette: Palette,
    private opts: { reducedMotion: boolean; clean: boolean },
  ) {
    const p = palette;
    const defs: [number, number, number, number, number][] = [
      [0.22, 0.28, p.cool, p.warm, 0.9],
      [0.8, 0.7, p.accent2, p.hot, 1.1],
      [0.62, 0.18, p.accent, p.warm, 0.7],
    ];
    for (const [fx, fy, from, to, size] of defs) {
      const s = new Sprite(tex.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.alpha = opts.clean ? 0.07 : 0.13;
      this.blobs.push({ s, fx, fy, phase: fx * 10, speed: 0.08 + fy * 0.05, size, from, to });
      this.view.addChild(s);
    }
    this.view.addChild(this.grid);

    this.vignette = new Sprite(tex.vignette);
    this.edge = new Sprite(tex.edge);
    this.edge.blendMode = 'add';
    this.edge.tint = p.hot;
    this.edge.alpha = 0;
    this.view.addChild(this.vignette, this.edge);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.vignette.width = this.edge.width = w;
    this.vignette.height = this.edge.height = h;

    const step = 44;
    this.grid.clear();
    for (let x = (w % step) / 2; x < w; x += step) {
      for (let y = (h % step) / 2; y < h; y += step) this.grid.circle(x, y, 1.2);
    }
    this.grid.fill({ color: this.palette.muted });
  }

  setTier(tier: number) {
    this.warmthTarget = [0, 0.35, 0.7, 1][tier] ?? 1;
    this.overdriveTarget = tier >= 3 ? 1 : 0;
  }

  pulse(strength = 1) {
    if (this.opts.reducedMotion) return;
    this.pulseV = Math.min(1, this.pulseV + strength * 0.6);
  }

  update(dt: number) {
    if (!this.frozen) this.t += dt;
    this.warmth = damp(this.warmth, this.warmthTarget, 2.5, dt);
    this.overdrive = damp(this.overdrive, this.overdriveTarget, 3, dt);
    this.pulseV = damp(this.pulseV, 0, 6, dt);

    const minDim = Math.min(this.w, this.h);
    const motion = this.opts.reducedMotion ? 0 : 1;
    for (const b of this.blobs) {
      const breath = 1 + 0.07 * Math.sin(this.t * 1.4 + b.phase) * motion;
      const drift = 0.04 * motion;
      b.s.x = this.w * (b.fx + drift * Math.sin(this.t * b.speed + b.phase));
      b.s.y = this.h * (b.fy + drift * Math.cos(this.t * b.speed * 1.3 + b.phase));
      b.s.width = b.s.height = minDim * 1.5 * b.size * breath * (1 + this.pulseV * 0.06);
      b.s.tint = lerpColor(b.from, b.to, this.warmth);
    }
    this.grid.alpha = 0.07 + this.pulseV * 0.12 + this.warmth * 0.03;
    this.edge.alpha = clamp(this.overdrive * (0.28 + this.pulseV * 0.3), 0, 0.7);
  }
}
