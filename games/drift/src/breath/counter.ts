/**
 * Breath counting, modelled on the Breath Counting Task (Levinson et al., 2014):
 * tap on out-breaths 1–8, "close the circle" on the 9th. Losing count isn't a
 * failure — noticing you drifted and starting again *is* the practice.
 */

export const ROUND = 9;

export interface CountState {
  /** Breaths tapped in the current round (0..8). */
  count: number;
  correct: number;
  miscounts: number;
  drifts: number;
}

export type CountAction = 'tap' | 'close' | 'drift';
export type CountEvent = 'count' | 'complete' | 'miscount' | 'overflow' | 'drift';

export const initialCount: CountState = { count: 0, correct: 0, miscounts: 0, drifts: 0 };

export function countStep(s: CountState, action: CountAction): { state: CountState; event: CountEvent } {
  switch (action) {
    case 'tap':
      // Tapping the 9th breath instead of closing means the count slipped.
      if (s.count >= ROUND - 1) return { state: { ...s, count: 0, miscounts: s.miscounts + 1 }, event: 'overflow' };
      return { state: { ...s, count: s.count + 1 }, event: 'count' };
    case 'close':
      if (s.count === ROUND - 1) return { state: { ...s, count: 0, correct: s.correct + 1 }, event: 'complete' };
      return { state: { ...s, count: 0, miscounts: s.miscounts + 1 }, event: 'miscount' };
    case 'drift':
      return { state: { ...s, count: 0, drifts: s.drifts + 1 }, event: 'drift' };
  }
}

export function countAccuracy(s: CountState): number | null {
  const attempts = s.correct + s.miscounts;
  return attempts ? s.correct / attempts : null;
}

/** Ignore taps closer together than this — nobody breathes that fast at rest. */
export const MIN_BREATH_GAP = 0.9;
