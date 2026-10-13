import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionRecord } from './stats';

const MAX = 2000;

interface HistoryState {
  sessions: SessionRecord[];
  add: (r: SessionRecord) => void;
  clear: () => void;
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      add: (r) => set((s) => ({ sessions: [...s.sessions, r].slice(-MAX) })),
      clear: () => set({ sessions: [] }),
    }),
    { name: 'drift-history', version: 1 },
  ),
);
