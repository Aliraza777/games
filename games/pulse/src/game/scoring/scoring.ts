import { clamp, mean, stddev } from '../../lib/math';

export const COMBO_TIERS = [10, 25, 50] as const;

export function comboTier(combo: number): number {
  let tier = 0;
  for (const t of COMBO_TIERS) if (combo >= t) tier++;
  return tier;
}

/** ×1 at no combo, linearly up to ×2 at a 50 combo. */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(combo, 50) / 50;
}

/** Normalized distance from center (0..1) that counts as a perfect hit. */
export const PERFECT_OFFSET = 0.25;

export function flickPoints(reactionMs: number, offset: number): number {
  const speed = clamp(1.6 - reactionMs / 1000, 0.5, 1.4);
  const accuracy = clamp(1.5 - offset, 0.5, 1.5);
  return Math.round(100 * speed * accuracy);
}

export function precisionPoints(offset: number): number {
  return Math.round(60 + 190 * (1 - clamp(offset, 0, 1)) ** 2);
}

export function reflexPoints(reactionMs: number): number {
  return Math.round(clamp(600 - reactionMs, 50, 450));
}

export type Judgement = 'perfect' | 'great' | 'good' | 'miss';

/** Timing windows in seconds for Flow mode. */
export const TIMING = { perfect: 0.05, great: 0.1, good: 0.18 } as const;

export function judge(deltaSec: number): Judgement {
  const d = Math.abs(deltaSec);
  if (d <= TIMING.perfect) return 'perfect';
  if (d <= TIMING.great) return 'great';
  if (d <= TIMING.good) return 'good';
  return 'miss';
}

const JUDGEMENT_POINTS: Record<Judgement, number> = { perfect: 300, great: 200, good: 100, miss: 0 };

export function flowPoints(j: Judgement, offset: number): number {
  return Math.round(JUDGEMENT_POINTS[j] * clamp(1.2 - 0.4 * offset, 0.8, 1.2));
}

/** 1 when values are perfectly even, towards 0 as they scatter. */
export function consistency(values: readonly number[]): number {
  if (values.length < 3) return 0.5;
  const m = mean(values);
  if (m === 0) return 0;
  return clamp(1 - stddev(values) / m, 0, 1);
}

/** Maps a lower-is-better value onto 0..1 (best → 1, worst → 0). */
export function lowerIsBetter(value: number, best: number, worst: number): number {
  return clamp((worst - value) / (worst - best), 0, 1);
}

export type Grade = 'S' | 'A' | 'B' | 'C';

export function gradeFor(rating: number): Grade {
  if (rating >= 0.88) return 'S';
  if (rating >= 0.72) return 'A';
  if (rating >= 0.52) return 'B';
  return 'C';
}
