import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VehicleId } from '../game/config';

export interface SettingsData {
  vehicle: VehicleId;
  sfx: number;
  music: number;
  musicOn: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  shake: number;
  /** Contextual hints until you've bridged your first gap. */
  tutorialDone: boolean;
}

export const DEFAULT_SETTINGS: SettingsData = {
  vehicle: 'car',
  sfx: 0.8,
  music: 0.5,
  musicOn: true,
  reducedMotion: 'system',
  shake: 0.8,
  tutorialDone: false,
};

export const useSettings = create<SettingsData & { update: (p: Partial<SettingsData>) => void }>()(
  persist((set) => ({ ...DEFAULT_SETTINGS, update: (p) => set(p) }), { name: 'inkway-settings', version: 1 }),
);

export function prefersReducedMotion(s: SettingsData['reducedMotion']) {
  if (s === 'on') return true;
  if (s === 'off') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
