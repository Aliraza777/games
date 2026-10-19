import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ACHIEVEMENTS, type Lifetime } from '../game/achievements';
import { DEFAULT_HANDLING, type Action, type Handling, type RunResult } from '../game/engine';
import { MODES, dayKey, type ModeId } from '../game/modes';
import { THEMES } from '../game/themes';

export interface BoardEntry {
  score: number;
  timeMs: number;
  lines: number;
  level: number;
  date: number;
}

export type Keys = Record<Action, string[]>;

export const DEFAULT_KEYS: Keys = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: ['Space'],
  cw: ['ArrowUp', 'KeyX'],
  ccw: ['KeyZ', 'ControlLeft'],
  r180: ['KeyA'],
  hold: ['KeyC', 'ShiftLeft', 'ShiftRight'],
};

export interface Settings {
  sound: number;
  music: number;
  haptics: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  ghost: boolean;
  grid: boolean;
  handling: Handling;
  keys: Keys;
  touchButtons: boolean;
  theme: string;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: 0.8,
  music: 0.5,
  haptics: true,
  reducedMotion: 'system',
  ghost: true,
  grid: true,
  handling: DEFAULT_HANDLING,
  keys: DEFAULT_KEYS,
  touchButtons: false,
  theme: 'neon',
};

const EMPTY_LIFETIME: Lifetime = { games: 0, lines: 0, pieces: 0, quads: 0, tspins: 0, perfectClears: 0, timeMs: 0 };

export interface RecordOutcome {
  /** Position on the mode's top-5 board (0 = best), or -1. */
  rank: number;
  newBest: boolean;
  previousBest: BoardEntry | null;
  board: BoardEntry[];
  achievements: string[];
  themes: string[];
  dailyStreak: number;
}

interface ProgressState {
  boards: Partial<Record<ModeId, BoardEntry[]>>;
  lifetime: Lifetime;
  achievements: string[];
  daily: Record<string, number>;
  lastMode: ModeId;
  tutorialDone: boolean;
  settings: Settings;
  record: (r: RunResult) => RecordOutcome;
  updateSettings: (p: Partial<Settings>) => void;
  setTutorialDone: (v?: boolean) => void;
  setLastMode: (m: ModeId) => void;
  resetProgress: () => void;
}

const better = (mode: ModeId) => (a: BoardEntry, b: BoardEntry) =>
  MODES[mode].rank === 'time' ? a.timeMs - b.timeMs : b.score - a.score || a.timeMs - b.timeMs;

/** Does this run belong on the board? Sprint needs a finish; score modes need some score. */
export function eligible(r: RunResult): boolean {
  if (MODES[r.mode].rank === 'time') return r.completed;
  if (r.mode === 'zen') return r.lines > 0;
  return r.reason !== 'quit' && r.lines > 0;
}

/** Consecutive days with a Daily played, ending today (or yesterday, if today isn't played yet). */
export function dailyStreak(daily: Record<string, number>, today = new Date()): number {
  const d = new Date(today);
  if (daily[dayKey(d)] == null) d.setDate(d.getDate() - 1);
  let n = 0;
  while (daily[dayKey(d)] != null) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      boards: {},
      lifetime: EMPTY_LIFETIME,
      achievements: [],
      daily: {},
      lastMode: 'marathon',
      tutorialDone: false,
      settings: DEFAULT_SETTINGS,
      record: (r) => {
        const s = get();
        const prevBoard = s.boards[r.mode] ?? [];
        const previousBest = prevBoard[0] ?? null;
        let board = prevBoard;
        let rank = -1;
        if (eligible(r)) {
          const entry: BoardEntry = { score: r.score, timeMs: r.timeMs, lines: r.lines, level: r.level, date: Date.now() };
          board = [...prevBoard, entry].sort(better(r.mode)).slice(0, 5);
          rank = board.indexOf(entry);
        }
        const lifetime: Lifetime = {
          games: s.lifetime.games + 1,
          lines: s.lifetime.lines + r.lines,
          pieces: s.lifetime.pieces + r.pieces,
          quads: s.lifetime.quads + r.quads,
          tspins: s.lifetime.tspins + r.tspins,
          perfectClears: s.lifetime.perfectClears + r.perfectClears,
          timeMs: s.lifetime.timeMs + r.timeMs,
        };
        const daily = { ...s.daily };
        if (r.mode === 'daily' && r.reason !== 'quit') daily[dayKey()] = Math.max(daily[dayKey()] ?? 0, r.score);
        const streak = dailyStreak(daily);
        const got = ACHIEVEMENTS.filter((a) => !s.achievements.includes(a.id) && a.test({ run: r, lifetime, dailyStreak: streak })).map((a) => a.id);
        const themes = THEMES.filter((t) => t.unlock > s.lifetime.lines && t.unlock <= lifetime.lines).map((t) => t.id);
        set({ boards: { ...s.boards, [r.mode]: board }, lifetime, daily, achievements: [...s.achievements, ...got] });
        return {
          rank,
          newBest: rank === 0 && previousBest != null,
          previousBest,
          board,
          achievements: got,
          themes,
          dailyStreak: streak,
        };
      },
      updateSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      setTutorialDone: (v = true) => set({ tutorialDone: v }),
      setLastMode: (m) => set({ lastMode: m }),
      resetProgress: () => set({ boards: {}, lifetime: EMPTY_LIFETIME, achievements: [], daily: {}, tutorialDone: false }),
    }),
    {
      name: 'stackfall-progress',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings, keys: { ...DEFAULT_KEYS, ...p.settings?.keys } } };
      },
    },
  ),
);

export function prefersReducedMotion(s: Settings['reducedMotion']) {
  if (s === 'on') return true;
  if (s === 'off') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const isTouchDevice = () => typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;

export function themeUnlocked(id: string, lines: number) {
  const t = THEMES.find((x) => x.id === id);
  return !!t && lines >= t.unlock;
}
