import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeId } from '../theme';

export type Soundscape = 'waves' | 'rain' | 'silence';

export interface SettingsData {
  theme: ThemeId;
  volume: number;
  soundscape: Soundscape;
  /** Soft bell on each phase change — lets you practise with eyes closed. */
  chimes: boolean;
  haptics: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  /** Paced practices: hold-to-breathe (interactive) or just follow the guide. */
  follow: boolean;
  checkIns: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: SettingsData = {
  theme: 'dusk',
  volume: 0.7,
  soundscape: 'waves',
  chimes: true,
  haptics: true,
  reducedMotion: 'system',
  follow: false,
  checkIns: true,
  onboarded: false,
};

interface Actions {
  update: (patch: Partial<SettingsData>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsData & Actions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set((s) => ({ ...DEFAULT_SETTINGS, onboarded: s.onboarded })),
    }),
    { name: 'drift-settings', version: 1 },
  ),
);

export function prefersReducedMotion(setting: SettingsData['reducedMotion']): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
