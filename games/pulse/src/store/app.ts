import { create } from 'zustand';
import type { ModeId, RunResult } from '../game/types';
import { randomSeed } from '../lib/rng';
import { bestScore, useHistory } from './history';
import { useSettings } from './settings';

export type Screen = 'onboarding' | 'home' | 'run' | 'results' | 'stats' | 'settings';

export interface RunConfig {
  mode: ModeId;
  seed: number;
  daily: boolean;
  /** Bumped on every (re)start so the run screen remounts with a fresh engine. */
  nonce: number;
}

export interface Toast {
  id: number;
  text: string;
}

interface AppState {
  screen: Screen;
  run: RunConfig | null;
  lastMode: ModeId;
  lastResult: RunResult | null;
  previousBest: number | null;
  toasts: Toast[];
  go: (screen: Screen) => void;
  startRun: (mode: ModeId, opts?: { daily?: boolean; seed?: number }) => void;
  restartRun: () => void;
  finishRun: (result: RunResult) => void;
  pushToast: (text: string) => void;
  dismissToast: (id: number) => void;
}

let nonce = 0;
let toastId = 0;

export const useApp = create<AppState>()((set, get) => ({
  screen: 'home',
  run: null,
  lastMode: 'flick',
  lastResult: null,
  previousBest: null,
  toasts: [],

  go: (screen) => set({ screen }),

  startRun: (mode, opts = {}) =>
    set({
      screen: 'run',
      lastMode: mode,
      run: { mode, daily: !!opts.daily, seed: opts.seed ?? randomSeed(), nonce: ++nonce },
    }),

  restartRun: () => {
    const run = get().run;
    if (!run) return;
    // Daily runs replay the same seed; regular runs get a fresh layout.
    set({ screen: 'run', run: { ...run, seed: run.daily ? run.seed : randomSeed(), nonce: ++nonce } });
  },

  finishRun: (result) => {
    const history = useHistory.getState();
    const previousBest = bestScore(history.runs, result.mode);
    history.add(result);
    set({ screen: 'results', lastResult: result, previousBest });
    maybeTip(result);
  },

  pushToast: (text) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text }] }));
    setTimeout(() => get().dismissToast(id), 4500);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** One gentle, contextual tip — never a tutorial wall. */
function maybeTip(result: RunResult) {
  const runs = useHistory.getState().runs.filter((r) => r.mode === result.mode).slice(-3);
  if (runs.length < 3) return;
  const { pushToast } = useApp.getState();
  if (result.mode !== 'track' && runs.every((r) => r.accuracy < 0.6)) {
    const sens = useSettings.getState().sensitivity;
    pushToast(
      sens > 0.8
        ? 'Missing a lot? Try lowering sensitivity a little in Settings.'
        : 'Tip: slow down slightly — accuracy multiplies your score more than speed.',
    );
  }
}
