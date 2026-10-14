import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SKINS } from '../game/config';
import type { RideResult } from '../game/Game';
import { LEVELS } from '../game/levels';

export interface LevelProgress {
  done: boolean;
  /** Gem indices ever collected on a finished run. */
  gems: number[];
  bestTime: number | null;
  bestFlips: number;
}

export interface Settings {
  sound: number;
  music: boolean;
  reducedMotion: 'system' | 'on' | 'off';
}

interface ProgressState {
  levels: Record<number, LevelProgress>;
  skin: string;
  tutorialDone: boolean;
  settings: Settings;
  complete: (r: RideResult) => { firstClear: boolean; newBestTime: boolean; newGems: number };
  setSkin: (id: string) => void;
  updateSettings: (p: Partial<Settings>) => void;
  setTutorialDone: () => void;
  reset: () => void;
}

const EMPTY: LevelProgress = { done: false, gems: [], bestTime: null, bestFlips: 0 };

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      levels: {},
      skin: 'spark',
      tutorialDone: false,
      settings: { sound: 0.8, music: true, reducedMotion: 'system' },
      complete: (r) => {
        const prev = get().levels[r.levelId] ?? EMPTY;
        const gems = [...new Set([...prev.gems, ...r.gems])].sort();
        const newBestTime = prev.bestTime == null || r.time < prev.bestTime;
        const next: LevelProgress = {
          done: true,
          gems,
          bestTime: newBestTime ? r.time : prev.bestTime,
          bestFlips: Math.max(prev.bestFlips, r.flips),
        };
        set({ levels: { ...get().levels, [r.levelId]: next } });
        return { firstClear: !prev.done, newBestTime: newBestTime && prev.bestTime != null, newGems: gems.length - prev.gems.length };
      },
      setSkin: (id) => {
        const skin = SKINS.find((s) => s.id === id);
        if (skin && totalGems(get().levels) >= skin.cost) set({ skin: id });
      },
      updateSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      setTutorialDone: () => set({ tutorialDone: true }),
      reset: () => set({ levels: {}, skin: 'spark', tutorialDone: false }),
    }),
    { name: 'flipline-progress', version: 1 },
  ),
);

export function totalGems(levels: Record<number, LevelProgress>): number {
  return Object.values(levels).reduce((n, l) => n + l.gems.length, 0);
}

export function isUnlocked(levels: Record<number, LevelProgress>, id: number): boolean {
  return id === 1 || !!levels[id - 1]?.done;
}

/** The level "Hold to play" should start: first unfinished, else the last. */
export function nextLevel(levels: Record<number, LevelProgress>): number {
  return LEVELS.find((l) => !levels[l.id]?.done)?.id ?? LEVELS[LEVELS.length - 1].id;
}

export function prefersReducedMotion(s: Settings['reducedMotion']) {
  if (s === 'on') return true;
  if (s === 'off') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const isTouchDevice = () => typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
