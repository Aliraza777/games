import { create } from 'zustand';
import type { VehicleId } from '../game/config';
import { randomSeed } from '../lib/rng';

export interface RunConfig {
  vehicle: VehicleId;
  seed: number;
  daily: boolean;
  nonce: number;
}

interface AppState {
  screen: 'title' | 'run';
  run: RunConfig | null;
  startRun: (vehicle: VehicleId, opts?: { daily?: boolean; seed?: number }) => void;
  restart: () => void;
  toTitle: () => void;
}

let nonce = 0;

export const useApp = create<AppState>()((set, get) => ({
  screen: 'title',
  run: null,
  startRun: (vehicle, opts = {}) =>
    set({ screen: 'run', run: { vehicle, daily: !!opts.daily, seed: opts.seed ?? randomSeed(), nonce: ++nonce } }),
  restart: () => {
    const r = get().run;
    if (r) set({ run: { ...r, seed: r.daily ? r.seed : randomSeed(), nonce: ++nonce } });
  },
  toTitle: () => set({ screen: 'title' }),
}));
