import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VehicleId } from '../game/config';
import type { RunResult } from '../game/Game';

export interface Best {
  score: number;
  distance: number;
}

interface RecordsState {
  best: Partial<Record<VehicleId, Best>>;
  daily: { seed: number; score: number } | null;
  runs: number;
  totalDistance: number;
  /** Saves a finished run; returns which records it broke. */
  add: (r: RunResult) => { newBest: boolean; newDaily: boolean; previous: Best | null };
}

export const useRecords = create<RecordsState>()(
  persist(
    (set, get) => ({
      best: {},
      daily: null,
      runs: 0,
      totalDistance: 0,
      add: (r) => {
        const s = get();
        const previous = s.best[r.vehicle] ?? null;
        const newBest = !previous || r.score > previous.score;
        const sameDay = s.daily?.seed === r.seed;
        const newDaily = r.daily && (!sameDay || r.score > (s.daily?.score ?? 0));
        set({
          runs: s.runs + 1,
          totalDistance: s.totalDistance + r.distance,
          best: newBest ? { ...s.best, [r.vehicle]: { score: r.score, distance: r.distance } } : s.best,
          daily: newDaily ? { seed: r.seed, score: r.score } : s.daily,
        });
        return { newBest: newBest && !!previous, newDaily, previous };
      },
    }),
    { name: 'inkway-records', version: 1 },
  ),
);
