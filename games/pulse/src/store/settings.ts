import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PaletteId } from '../theme/palettes';
import { idbStorage } from './idbStorage';

export type CrosshairShape = 'cross' | 'dot' | 'circle' | 'cross-dot';

export interface CrosshairSettings {
  shape: CrosshairShape;
  size: number;
  gap: number;
  thickness: number;
  color: string;
  outline: boolean;
}

export interface SettingsData {
  sensitivity: number;
  pointerLock: boolean;
  crosshair: CrosshairSettings;
  palette: PaletteId;
  reducedMotion: 'system' | 'on' | 'off';
  effects: 'full' | 'clean';
  shake: number;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  targetScale: number;
  gameSpeed: number;
  runLength: 30 | 45 | 60;
  onboarded: boolean;
}

interface SettingsActions {
  update: (patch: Partial<SettingsData>) => void;
  updateCrosshair: (patch: Partial<CrosshairSettings>) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS: SettingsData = {
  sensitivity: 1,
  pointerLock: true,
  crosshair: { shape: 'cross-dot', size: 7, gap: 4, thickness: 2, color: '#ffffff', outline: true },
  palette: 'default',
  reducedMotion: 'system',
  effects: 'full',
  shake: 0.7,
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.6,
  muted: false,
  targetScale: 1,
  gameSpeed: 1,
  runLength: 30,
  onboarded: false,
};

export const useSettings = create<SettingsData & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      updateCrosshair: (patch) => set((s) => ({ crosshair: { ...s.crosshair, ...patch } })),
      // Keep onboarding state — resetting settings shouldn't replay the intro.
      reset: () => set((s) => ({ ...DEFAULT_SETTINGS, onboarded: s.onboarded })),
    }),
    {
      name: 'pulse-settings',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsData>;
        return { ...current, ...p, crosshair: { ...current.crosshair, ...p.crosshair } };
      },
    },
  ),
);

export function prefersReducedMotion(setting: SettingsData['reducedMotion']): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
