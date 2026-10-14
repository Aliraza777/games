import { create } from 'zustand';

export type Screen = 'title' | 'levels' | 'garage' | 'ride';

interface AppState {
  screen: Screen;
  ride: { levelId: number; nonce: number } | null;
  go: (s: Screen) => void;
  play: (levelId: number) => void;
}

let nonce = 0;
export const useApp = create<AppState>()((set) => ({
  screen: 'title',
  ride: null,
  go: (screen) => set({ screen }),
  play: (levelId) => set({ screen: 'ride', ride: { levelId, nonce: ++nonce } }),
}));
