import { create } from 'zustand';
import type { PracticeId } from '../breath/practices';
import type { Soundscape } from './settings';

export type Screen = 'onboarding' | 'home' | 'session' | 'journey' | 'settings';

export interface SessionConfig {
  practice: PracticeId;
  minutes: number;
  soundscape: Soundscape;
  follow: boolean;
  tensionBefore: number | null;
  /** Bumped per start so "again" remounts a fresh session. */
  nonce: number;
}

interface AppState {
  screen: Screen;
  setupFor: PracticeId | null;
  session: SessionConfig | null;
  go: (s: Screen) => void;
  openSetup: (id: PracticeId) => void;
  closeSetup: () => void;
  startSession: (cfg: Omit<SessionConfig, 'nonce'>) => void;
  again: () => void;
}

let nonce = 0;

export const useApp = create<AppState>()((set, get) => ({
  screen: 'home',
  setupFor: null,
  session: null,
  go: (screen) => set({ screen, setupFor: null }),
  openSetup: (id) => set({ setupFor: id }),
  closeSetup: () => set({ setupFor: null }),
  startSession: (cfg) => set({ screen: 'session', setupFor: null, session: { ...cfg, nonce: ++nonce } }),
  again: () => {
    const s = get().session;
    if (s) set({ session: { ...s, tensionBefore: null, nonce: ++nonce } });
  },
}));
