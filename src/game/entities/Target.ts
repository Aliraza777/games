import { Container, Graphics, Sprite } from 'pixi.js';
import type { FxTextures } from '../engine/textures';
import { TAU, clamp, damp, easeInCubic, easeOutBack, easeOutCubic, lerpColor } from '../../lib/math';

export type TargetStyle = 'bloom' | 'rings' | 'orb' | 'beat' | 'flash' | 'zen';
export type DeathKind = 'hit' | 'expire' | 'vanish';

export interface TargetOpts {
  x: number;
  y: number;
  radius: number;
  style: TargetStyle;
  bornAt: number;
  color: number;
  coolColor: number;
  reducedMotion: boolean;
  /** Seconds before it expires (drives the countdown ring). Omit for none. */
  lifetime?: number;
  /** Fraction of radius lost by end of life (Precision). */
  shrink?: number;
  /** Show a closing approach ring (Flow). */
  approach?: boolean;
}

export interface HitInfo {
  /** Distance from center, normalized by radius (0 = dead center). */
  d: number;
  dx: number;
  dy: number;
}

const W = 0xffffff;

/**
 * A target's whole lifecycle is visual-only here: spawn bloom, idle breathing,
 * countdown ring, color drift as it expires, and hit/expire death animations.
 * Game rules live in the modes.
 */
export class Target {
  readonly view = new Container();
  readonly style: TargetStyle;
  readonly bornAt: number;
  readonly lifetime: number;
  readonly baseRadius: number;
  x: number;
  y: number;
  radius: number;
  state: 'alive' | 'dying' | 'dead' = 'alive';
  /** 0..1, set by the owning mode each step. */
  lifeFrac = 0;
  approachFrac = 0;
  glowTarget = 0;
  /** Free-form slot for modes (e.g. drift velocity). */
  data: Record<string, number> = {};

  private age = 0;
  private deathAge = 0;
  private deathKind: DeathKind = 'hit';
  private glowBoost = 0;
  private lastTimer = -1;
  private readonly body = new Container();
  private readonly glow: Sprite;
  private readonly timer = new Graphics();
  private readonly petals?: Container;
  private readonly approachRing?: Graphics;
  private readonly color: number;
  private readonly coolColor: number;
  private readonly rm: boolean;
  private readonly shrink: number;
  private readonly glowBase: number;

  constructor(tex: FxTextures, o: TargetOpts) {
    this.style = o.style;
    this.bornAt = o.bornAt;
    this.lifetime = o.lifetime ?? Infinity;
    this.x = o.x;
    this.y = o.y;
    this.baseRadius = this.radius = o.radius;
    this.color = o.color;
    this.coolColor = o.coolColor;
    this.rm = o.reducedMotion;
    this.shrink = o.shrink ?? 0;
    const r = o.radius;

    this.glowBase = o.style === 'orb' ? 0.55 : o.style === 'zen' ? 0.4 : 0.28;
    this.glow = new Sprite(tex.glow);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.alpha = this.glowBase;
    this.view.addChild(this.glow, this.body, this.timer);

    const g = new Graphics();
    switch (o.style) {
      case 'bloom': {
        const petals = new Container();
        for (let i = 0; i < 6; i++) {
          const p = new Sprite(tex.petal);
          p.anchor.set(0.5, 1);
          p.width = r * 0.62;
          p.height = r * 1.08;
          p.rotation = (i * TAU) / 6;
          p.alpha = 0.3;
          petals.addChild(p);
        }
        this.petals = petals;
        this.body.addChild(petals);
        g.circle(0, 0, r).fill({ color: W, alpha: 0.14 }).stroke({ width: 2.5, color: W, alpha: 0.95 });
        g.circle(0, 0, r * 0.5).stroke({ width: 1.5, color: W, alpha: 0.45 });
        g.circle(0, 0, r * 0.16).fill({ color: W });
        break;
      }
      case 'rings':
        g.circle(0, 0, r).fill({ color: W, alpha: 0.08 }).stroke({ width: 2, color: W, alpha: 0.95 });
        g.circle(0, 0, r * 0.66).stroke({ width: 1.5, color: W, alpha: 0.7 });
        g.circle(0, 0, r * 0.33).stroke({ width: 1.5, color: W, alpha: 0.55 });
        g.circle(0, 0, r * 0.12).fill({ color: W });
        break;
      case 'orb':
        g.circle(0, 0, r).fill({ color: W, alpha: 0.85 });
        g.circle(0, 0, r * 0.45).fill({ color: W });
        break;
      case 'flash':
        g.circle(0, 0, r).fill({ color: W, alpha: 0.35 }).stroke({ width: 3, color: W });
        g.circle(0, 0, r * 0.18).fill({ color: W });
        break;
      case 'zen':
        g.circle(0, 0, r).fill({ color: W, alpha: 0.2 }).stroke({ width: 1.5, color: W, alpha: 0.5 });
        g.circle(0, 0, r * 0.12).fill({ color: W, alpha: 0.8 });
        break;
      case 'beat':
        g.circle(0, 0, r).fill({ color: W, alpha: 0.18 }).stroke({ width: 3, color: W, alpha: 0.95 });
        g.circle(0, 0, r * 0.18).fill({ color: W });
        break;
    }
    this.body.addChild(g);

    if (o.approach) {
      this.approachRing = new Graphics().circle(0, 0, r).stroke({ width: 2.5, color: W });
      this.view.addChild(this.approachRing);
    }

    this.view.position.set(o.x, o.y);
    this.view.tint = o.color;
    this.update(0);
  }

  hit(px: number, py: number): HitInfo | null {
    if (this.state !== 'alive') return null;
    const dx = px - this.x, dy = py - this.y;
    const d = Math.hypot(dx, dy) / this.radius;
    // A couple of pixels of forgiveness on the edge feels fair, not sloppy.
    if (d > 1 + 2 / this.radius) return null;
    return { d: Math.min(d, 1), dx: dx / this.radius, dy: dy / this.radius };
  }

  kill(kind: DeathKind) {
    if (this.state !== 'alive') return;
    this.state = 'dying';
    this.deathKind = kind;
    this.deathAge = 0;
    this.timer.visible = false;
    if (this.approachRing) this.approachRing.visible = false;
  }

  /** Returns false once fully gone. */
  update(dt: number): boolean {
    if (this.state === 'dead') return false;
    this.age += dt;
    const style = this.style;

    const spawnDur = style === 'flash' ? 0.06 : style === 'zen' ? 0.5 : 0.18;
    const k = clamp(this.age / spawnDur, 0, 1);
    let scale = 1;
    let alpha = 1;
    if (this.rm) alpha = k;
    else scale = style === 'zen' ? easeOutCubic(k) : easeOutBack(k, 1.4);

    if (this.petals && !this.rm) {
      const pk = easeOutCubic(clamp(this.age / 0.32, 0, 1));
      this.petals.rotation = (1 - pk) * -0.9;
      this.petals.scale.set(pk);
    }

    if (!this.rm) {
      const amp = style === 'zen' ? 0.05 : 0.022;
      scale *= 1 + amp * Math.sin(this.age * (style === 'zen' ? 1.6 : 4.2));
    }

    const shrinkScale = 1 - this.shrink * clamp(this.lifeFrac, 0, 1);
    this.radius = this.baseRadius * shrinkScale;

    if (Number.isFinite(this.lifetime)) {
      const cool = clamp((this.lifeFrac - 0.55) / 0.45, 0, 1);
      this.view.tint = lerpColor(this.color, this.coolColor, cool);
      if (this.state === 'alive' && style !== 'orb' && style !== 'flash') {
        const rem = 1 - clamp(this.lifeFrac, 0, 1);
        if (Math.abs(rem - this.lastTimer) > 0.004 || this.shrink) {
          this.lastTimer = rem;
          this.timer.clear();
          if (rem > 0.001) {
            this.timer
              .arc(0, 0, this.radius + 6, -Math.PI / 2, -Math.PI / 2 + rem * TAU)
              .stroke({ width: 2.5, color: W, alpha: 0.55, cap: 'round' });
          }
        }
      }
    }

    if (this.approachRing) {
      const a = clamp(this.approachFrac, 0, 1);
      this.approachRing.scale.set(1 + 2.2 * (1 - a));
      this.approachRing.alpha = clamp(a * 1.6, 0, 0.9);
    }

    this.glowBoost = damp(this.glowBoost, this.glowTarget, 12, dt);
    this.glow.alpha = this.glowBase + 0.35 * this.glowBoost;
    this.glow.width = this.glow.height = this.radius * 4.2 * scale * (1 + 0.3 * this.glowBoost);

    let y = this.y;
    let sx = scale * shrinkScale;
    let sy = sx;
    if (this.state === 'dying') {
      this.deathAge += dt;
      let t: number;
      switch (this.deathKind) {
        case 'hit':
          t = clamp(this.deathAge / 0.16, 0, 1);
          // Quick squash on impact, then it pops outward and fades.
          sx *= 1 + 0.45 * easeOutCubic(t);
          sy *= t < 0.3 ? 1 - 0.25 * (t / 0.3) : 0.75 + 0.7 * easeOutCubic((t - 0.3) / 0.7);
          alpha = 1 - t;
          break;
        case 'expire':
          t = clamp(this.deathAge / 0.28, 0, 1);
          y += 14 * easeInCubic(t);
          sx *= 1 - 0.15 * t;
          sy = sx;
          alpha = 1 - t;
          break;
        default:
          t = clamp(this.deathAge / 0.3, 0, 1);
          sx *= 1 - 0.3 * t;
          sy = sx;
          alpha = 1 - t;
      }
      if (t >= 1) {
        this.state = 'dead';
        this.view.visible = false;
        return false;
      }
    }

    this.body.scale.set(sx, sy);
    this.view.alpha = alpha;
    this.view.position.set(this.x, y);
    return true;
  }
}
