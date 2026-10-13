import { clamp } from '../lib/math';
import { expectsHold, inOutSeconds, type BreathPattern } from './patterns';
import type { PhaseState } from './timeline';

/** Seconds after each phase change that aren't scored — nobody reacts instantly. */
export const GRACE = 0.5;
/** A breath counts as "in harmony" at or above this share of matched time. */
export const HARMONY_THRESHOLD = 0.7;

/**
 * Compares the player's hold/release with the guide. This is behavioural
 * pacing feedback, not a physiological measurement.
 */
export class SyncTracker {
  readonly cycleScores: number[] = [];
  private matched = 0;
  private scored = 0;
  private cycleMatched = 0;
  private cycleScored = 0;
  private cycle = 0;

  /** Returns the finished cycle's score when a new cycle starts. */
  sample(state: PhaseState, held: boolean, dt: number): number | null {
    let finished: number | null = null;
    if (state.cycle > this.cycle) {
      finished = this.closeCycle();
      this.cycle = state.cycle;
    }
    if (state.elapsed < GRACE || dt <= 0) return finished;
    this.scored += dt;
    this.cycleScored += dt;
    if (held === expectsHold(state.phase.kind)) {
      this.matched += dt;
      this.cycleMatched += dt;
    }
    return finished;
  }

  /** Close out the in-progress cycle (call once when the session ends). */
  finish(): number | null {
    return this.closeCycle();
  }

  get harmony(): number | null {
    return this.scored > 0 ? this.matched / this.scored : null;
  }

  get harmoniousCycles(): number {
    return this.cycleScores.filter((s) => s >= HARMONY_THRESHOLD).length;
  }

  private closeCycle(): number | null {
    if (this.cycleScored <= 0) return null;
    const score = this.cycleMatched / this.cycleScored;
    this.cycleScores.push(score);
    this.cycleMatched = this.cycleScored = 0;
    return score;
  }
}

/**
 * The player's own light: fills while they hold, empties when they let go,
 * at the same pace as the pattern so a matched breath lines up with the guide.
 */
export class PlayerBreath {
  level = 0;
  private inRate: number;
  private outRate: number;

  constructor(p: BreathPattern) {
    const { inhale, exhale } = inOutSeconds(p);
    this.inRate = 1 / Math.max(inhale, 0.5);
    this.outRate = 1 / Math.max(exhale, 0.5);
  }

  update(held: boolean, dt: number): number {
    this.level = clamp(this.level + (held ? this.inRate : -this.outRate) * dt, 0, 1);
    return this.level;
  }
}
