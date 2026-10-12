import { mean } from '../../lib/math';
import type { Target } from '../entities/Target';
import { PERFECT_OFFSET, consistency, flickPoints, lowerIsBetter } from '../scoring/scoring';
import type { Vec } from '../types';
import { BaseMode, type ModeSummary } from './BaseMode';

export class FlickMode extends BaseMode {
  readonly id = 'flick' as const;
  private target: Target | null = null;
  private last: Vec | undefined;
  private get lifetime() {
    return 1.7 / this.e.settings.gameSpeed;
  }

  start() {
    this.spawn();
  }

  private spawn() {
    const r = this.e.baseRadius();
    const pf = this.e.playfield(r * 1.6);
    const p = this.randomPoint(r * 1.6, this.last, Math.min(pf.w, pf.h) * 0.25);
    this.last = p;
    this.target = this.e.spawnTarget({ x: p.x, y: p.y, radius: r, style: 'bloom', lifetime: this.lifetime });
  }

  step() {
    const t = this.target;
    if (!t) return;
    const age = this.e.time - t.bornAt;
    t.lifeFrac = age / this.lifetime;
    if (age >= this.lifetime) {
      this.e.penalize({ x: t.x, y: t.y, kind: 'expire', label: 'too slow' });
      t.kill('expire');
      this.spawn();
    }
  }

  pointerDown(x: number, y: number) {
    const t = this.target;
    const hit = t?.hit(x, y);
    if (!t || !hit) {
      this.e.penalize({ x, y, kind: 'miss' });
      return;
    }
    const reaction = (this.e.time - t.bornAt) * 1000;
    this.e.reward({
      x: t.x,
      y: t.y,
      radius: t.radius,
      points: flickPoints(reaction, hit.d),
      perfect: hit.d < PERFECT_OFFSET,
      offset: hit,
      reactionMs: reaction,
      petals: true,
    });
    t.kill('hit');
    this.spawn();
  }

  summary(): ModeSummary {
    const e = this.e;
    const acc = e.accuracy();
    const avg = mean(e.reactions);
    return {
      accuracy: acc,
      rating: 0.5 * acc + 0.3 * lowerIsBetter(avg || 2000, 380, 1000) + 0.2 * consistency(e.reactions),
      histogram: { label: 'Time to hit', values: e.reactions, min: 150, max: 1300, unit: 'ms' },
      extra: [
        { label: 'Perfect hits', value: String(e.perfects) },
        { label: 'Consistency', value: `${Math.round(consistency(e.reactions) * 100)}%` },
      ],
    };
  }
}
