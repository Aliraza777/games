import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ModeId, RunResult } from '../game/types';
import { idbStorage } from './idbStorage';

/** What we keep long-term — the per-click detail only lives on the results screen. */
export type StoredRun = Omit<RunResult, 'offsets' | 'histogram'>;

const MAX_RUNS = 1000;

interface HistoryState {
  runs: StoredRun[];
  add: (r: RunResult) => void;
  clear: () => void;
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      runs: [],
      add: (r) => {
        const { offsets: _o, histogram: _h, ...stored } = r;
        set((s) => ({ runs: [...s.runs, stored].slice(-MAX_RUNS) }));
      },
      clear: () => set({ runs: [] }),
    }),
    { name: 'pulse-history', version: 1, storage: createJSONStorage(() => idbStorage) },
  ),
);

export function runsFor(runs: StoredRun[], mode: ModeId): StoredRun[] {
  return runs.filter((r) => r.mode === mode);
}

export function bestScore(runs: StoredRun[], mode: ModeId, opts: { dailySeed?: number } = {}): number | null {
  let best: number | null = null;
  for (const r of runs) {
    if (r.mode !== mode) continue;
    if (opts.dailySeed != null && (!r.daily || r.seed !== opts.dailySeed)) continue;
    if (best == null || r.score > best) best = r.score;
  }
  return best;
}
