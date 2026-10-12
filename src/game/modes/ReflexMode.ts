import { mean } from '../../lib/math';
import type { Target } from '../entities/Target';
import { lowerIsBetter, reflexPoints } from '../scoring/scoring';
import { BaseMode, type ModeSummary } from './BaseMode';

const TRIALS = 12;
const TIMEOUT = 1.5;

/**
 * The background breathes while you wait. The instant a target appears,
 * everything freezes — that stillness is the signal.
 */
export class ReflexMode extends BaseMode {
  readonly id = 'reflex' as const;
  allowHitstop = false;
  private phase: 'wait' | 'live' | 'rest' = 'wait';
  private until = 0;
  private trial = 0;
  private early = 0;
  private target: Target | null = null;
  private appearedAt = 0;
  /** performance.now() of the first frame the target was actually drawn. */
  private shownAt = 0;

  start() {
    this.wait();
  }

  private wait(extra = 0) {
    this.phase = 'wait';
    this.until = this.e.time + 0.9 + this.e.rng() * 1.8 + extra;
    this.e.bg.frozen = false;
  }

  step() {
    const e = this.e;
    if (this.phase === 'wait' && e.time >= this.until) {
      const r = e.baseRadius() * 1.1;
      const p = this.randomPoint(r * 2);
      this.target = e.spawnTarget({ x: p.x, y: p.y, radius: r, style: 'flash', lifetime: TIMEOUT });
      e.fx.ripple(p.x, p.y, { color: 0xffffff, from: r, to: r * 2.5, life: 0.2, alpha: 0.8 });
      this.appearedAt = e.time;
      this.shownAt = 0;
      this.phase = 'live';
      e.bg.frozen = true;
    } else if (this.phase === 'live' && this.target) {
      const age = e.time - this.appearedAt;
      this.target.lifeFrac = age / TIMEOUT;
      if (age >= TIMEOUT) {
        e.penalize({ x: this.target.x, y: this.target.y, kind: 'expire', label: 'missed it' });
        this.target.kill('expire');
        this.next();
      }
    } else if (this.phase === 'rest' && e.time >= this.until && this.trial < TRIALS) {
      this.wait();
    }
  }

  render() {
    if (this.phase === 'live' && !this.shownAt) this.shownAt = performance.now();
  }

  private next() {
    this.trial++;
    this.target = null;
    this.phase = 'rest';
    this.until = this.e.time + 0.55;
  }

  pointerDown(x: number, y: number, ts: number) {
    const e = this.e;
    if (this.phase === 'wait') {
      this.early++;
      e.penalize({ x, y, kind: 'early', label: 'too early' });
      this.wait(0.4);
      return;
    }
    const t = this.target;
    if (this.phase !== 'live' || !t) return;
    const hit = t.hit(x, y);
    if (!hit) {
      e.penalize({ x, y, kind: 'miss' });
      return;
    }
    const ms = this.shownAt ? Math.max(0, ts - this.shownAt) : (e.time - this.appearedAt) * 1000;
    e.reward({
      x: t.x,
      y: t.y,
      radius: t.radius,
      points: reflexPoints(ms),
      perfect: ms < 220,
      offset: hit,
      reactionMs: ms,
      label: `${Math.round(ms)} ms`,
    });
    t.kill('hit');
    this.next();
  }

  isOver() {
    return this.trial >= TRIALS && this.phase === 'rest' && this.e.time >= this.until;
  }
  progress() {
    return this.trial / TRIALS;
  }
  timeLeft() {
    return null;
  }
  hudLabel() {
    return `${Math.min(this.trial + 1, TRIALS)} / ${TRIALS}`;
  }

  destroy() {
    this.e.bg.frozen = false;
  }

  summary(): ModeSummary {
    const r = this.e.reactions;
    const avg = mean(r);
    const acc = this.e.accuracy();
    return {
      accuracy: acc,
      avgReaction: r.length ? avg : null,
      rating: Math.max(0, lowerIsBetter(avg || 1000, 200, 480) * 0.8 + acc * 0.2 - this.early * 0.03),
      histogram: { label: 'Reaction time', values: r, min: 100, max: 700, unit: 'ms' },
      extra: [
        { label: 'Fastest', value: r.length ? `${Math.round(Math.min(...r))} ms` : '—' },
        { label: 'Early clicks', value: String(this.early) },
      ],
    };
  }
}
