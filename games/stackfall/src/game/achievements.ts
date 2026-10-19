import type { RunResult } from './engine';

export interface Lifetime {
  games: number;
  lines: number;
  pieces: number;
  quads: number;
  tspins: number;
  perfectClears: number;
  timeMs: number;
}

export interface AchievementCtx {
  run: RunResult;
  lifetime: Lifetime;
  dailyStreak: number;
}

export interface Achievement {
  id: string;
  name: string;
  hint: string;
  test: (c: AchievementCtx) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-line', name: 'First Line', hint: 'Clear a line', test: (c) => c.run.lines > 0 },
  { id: 'quad', name: 'Four at Once', hint: 'Clear 4 lines with one piece', test: (c) => c.run.quads > 0 },
  { id: 'tspin', name: 'Twist', hint: 'Clear lines with a T-spin', test: (c) => c.run.tspins > 0 },
  { id: 'tsd', name: 'Double Twist', hint: 'Land a T-spin double', test: (c) => c.run.tspinDoubles > 0 },
  { id: 'tst', name: 'Triple Twist', hint: 'Land a T-spin triple', test: (c) => c.run.tspinTriples > 0 },
  { id: 'combo5', name: 'Chain Reaction', hint: 'Reach a 5 combo', test: (c) => c.run.maxCombo >= 5 },
  { id: 'combo10', name: 'Unbroken', hint: 'Reach a 10 combo', test: (c) => c.run.maxCombo >= 10 },
  { id: 'b2b3', name: 'Back to Back', hint: 'Chain 3 back-to-back clears', test: (c) => c.run.maxB2b >= 3 },
  { id: 'pc', name: 'Clean Slate', hint: 'Get a perfect clear', test: (c) => c.run.perfectClears > 0 },
  { id: 'level10', name: 'Double Digits', hint: 'Reach level 10', test: (c) => c.run.level >= 10 },
  { id: 'marathon', name: 'Marathoner', hint: 'Finish Marathon (150 lines)', test: (c) => c.run.mode === 'marathon' && c.run.completed },
  { id: 'sprint90', name: 'Quick Hands', hint: 'Sprint 40 lines under 1:30', test: (c) => c.run.mode === 'sprint' && c.run.completed && c.run.timeMs < 90_000 },
  { id: 'sprint60', name: 'Lightning', hint: 'Sprint 40 lines under 1:00', test: (c) => c.run.mode === 'sprint' && c.run.completed && c.run.timeMs < 60_000 },
  { id: 'ultra20k', name: 'Score Rush', hint: 'Score 20,000 in Ultra', test: (c) => c.run.mode === 'ultra' && c.run.score >= 20_000 },
  { id: 'pps2', name: 'Speed Demon', hint: '2+ pieces/sec over 100 pieces', test: (c) => c.run.pieces >= 100 && c.run.pps >= 2 },
  { id: 'daily3', name: 'Habit', hint: 'Play the Daily 3 days in a row', test: (c) => c.dailyStreak >= 3 },
  { id: 'daily7', name: 'Week Streak', hint: 'Play the Daily 7 days in a row', test: (c) => c.dailyStreak >= 7 },
  { id: 'lines1000', name: 'Thousand Lines', hint: 'Clear 1,000 lines in total', test: (c) => c.lifetime.lines >= 1000 },
];
