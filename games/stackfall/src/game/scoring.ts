/** Guideline-style scoring, as pure functions. */

export type Spin = 'none' | 'mini' | 'full';

const LINE_POINTS = [0, 100, 300, 500, 800];
const MINI_POINTS = [100, 200, 400];
const SPIN_POINTS = [400, 800, 1200, 1600];
const PC_POINTS = [0, 800, 1200, 1800, 2000];

/** "Difficult" clears keep (and benefit from) a back-to-back chain. */
export const isDifficult = (lines: number, spin: Spin) => lines > 0 && (lines === 4 || spin !== 'none');

export function basePoints(lines: number, spin: Spin): number {
  if (spin === 'full') return SPIN_POINTS[Math.min(lines, 3)];
  if (spin === 'mini') return MINI_POINTS[Math.min(lines, 2)];
  return LINE_POINTS[Math.min(lines, 4)];
}

export interface ClearScore {
  points: number;
  b2b: boolean;
  label: string;
}

/**
 * Score one lock. `b2bActive` is whether the previous difficult clear is still chained;
 * `combo` is the combo count after this clear (0 for the first clear of a chain).
 */
export function scoreClear(o: { lines: number; spin: Spin; level: number; b2bActive: boolean; combo: number; perfect: boolean }): ClearScore {
  const { lines, spin, level, combo, perfect } = o;
  const b2b = o.b2bActive && isDifficult(lines, spin);
  let points = basePoints(lines, spin) * level;
  if (b2b) points = Math.floor(points * 1.5);
  if (lines > 0 && combo > 0) points += 50 * combo * level;
  if (perfect && lines > 0) points += (lines === 4 && b2b ? 3200 : PC_POINTS[lines]) * level;
  return { points, b2b, label: clearLabel(lines, spin) };
}

export function clearLabel(lines: number, spin: Spin): string {
  const n = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'][Math.min(lines, 4)];
  if (spin === 'none') return n;
  const s = spin === 'mini' ? 'T-SPIN MINI' : 'T-SPIN';
  return n ? `${s} ${n}` : s;
}

/** Seconds per row at a given level (guideline curve, ~20G by level 20). */
export function gravitySeconds(level: number): number {
  const l = Math.max(1, Math.min(level, 20));
  return Math.pow(0.8 - (l - 1) * 0.007, l - 1);
}
