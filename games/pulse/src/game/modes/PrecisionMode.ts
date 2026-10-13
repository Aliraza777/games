import { audio } from '../../audio/AudioManager';
import { mean } from '../../lib/math';
import type { Target } from '../entities/Target';
import { precisionPoints } from '../scoring/scoring';
import type { Vec } from '../types';
import { BaseMode, type ModeSummary } from './BaseMode';

const CENTER = 0.2;

export class PrecisionMode extends BaseMode {
  readonly id = 'precision' as const;
  private target: Target | null = null;
  private last: Vec | undefined;
  private hitDistances: number[] = [];
  private centers = 0;
  private get lifetime() {
    return 2.4 / this.e.settings.gameSpeed;
  }

  start() {
    this.spawn();
  }

  private spawn() {
    const r = this.e.baseRadius() * 0.62;
    const p = this.randomPoint(r * 3, this.last, r * 6);
    this.last = p;
    this.target = this.e.spawnTarget({ x: p.x, y: p.y, radius: r, style: 'rings', lifetime: this.lifetime, shrink: 0.5 });
  }

  step() {
    const t = this.target;
    if (!t) return;
    const age = this.e.time - t.bornAt;
    t.lifeFrac = age / this.lifetime;
    if (age >= this.lifetime) {
      this.e.penalize({ x: t.x, y: t.y, kind: 'expire', label: 'gone' });
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
    const center = hit.d < CENTER;
    this.hitDistances.push(hit.d);
    if (center) {
      this.centers++;
      this.e.slowMo(0.3, 0.22);
      audio.ping();
    }
    this.e.reward({
      x: t.x,
      y: t.y,
      radius: t.radius,
      points: precisionPoints(hit.d),
      perfect: center,
      offset: hit,
      label: center ? 'CENTER' : undefined,
    });
    t.kill('hit');
    this.spawn();
  }

  summary(): ModeSummary {
    const acc = this.e.accuracy();
    const closeness = this.hitDistances.length ? 1 - mean(this.hitDistances) : 0;
    return {
      accuracy: acc,
      rating: 0.5 * acc + 0.5 * Math.min(1, closeness * 1.25),
      offsetsLabel: 'Where you hit (relative to center)',
      histogram: {
        label: 'Distance from center',
        values: this.hitDistances.map((d) => Math.round(d * 100)),
        min: 0,
        max: 100,
        unit: '% of radius',
      },
      extra: [
        { label: 'Center hits', value: String(this.centers) },
        { label: 'Avg distance', value: `${Math.round(mean(this.hitDistances) * 100)}% of radius` },
      ],
    };
  }
}
