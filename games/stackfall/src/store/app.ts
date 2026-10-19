import { create } from 'zustand';
import type { ModeId } from '../game/modes';

export type Screen = 'title' | 'play' | 'progress';

interface AppState {
  screen: Screen;
  run: { mode: ModeId; nonce: number } | null;
  settingsOpen: boolean;
  helpOpen: boolean;
  go: (s: Screen) => void;
  play: (mode: ModeId) => void;
  setSettingsOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
}

let nonce = 0;
export const useApp = create<AppState>()((set) => ({
  screen: 'title',
  run: null,
  settingsOpen: false,
  helpOpen: false,
  go: (screen) => set({ screen }),
  play: (mode) => set({ screen: 'play', run: { mode, nonce: ++nonce } }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));
