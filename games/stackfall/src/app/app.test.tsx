import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RunResult } from '../game/engine';
import { dayKey } from '../game/modes';
import { useApp } from '../store/app';
import { DEFAULT_SETTINGS, dailyStreak, useProgress } from '../store/progress';
import { App } from './App';

const run = (p: Partial<RunResult>): RunResult => ({
  score: 1000, lines: 10, level: 2, pieces: 30, timeMs: 60_000, quads: 0, tspins: 0, tspinDoubles: 0, tspinTriples: 0,
  maxCombo: 0, maxB2b: 0, perfectClears: 0, holds: 0, mode: 'marathon', reason: 'topout', completed: false, pps: 0.5, seed: 1, ...p,
});

beforeEach(() => {
  useProgress.setState({ boards: {}, lifetime: { games: 0, lines: 0, pieces: 0, quads: 0, tspins: 0, perfectClears: 0, timeMs: 0 }, achievements: [], daily: {}, lastMode: 'marathon', tutorialDone: false, settings: { ...DEFAULT_SETTINGS, sound: 0, music: 0, reducedMotion: 'on' } });
  useApp.setState({ screen: 'title', run: null, settingsOpen: false, helpOpen: false });
});

describe('records', () => {
  it('keeps a top-5 board, flags new bests and the gap to beat', () => {
    const rec = useProgress.getState().record;
    expect(rec(run({ score: 1000 }))).toMatchObject({ rank: 0, newBest: false, previousBest: null });
    expect(rec(run({ score: 800 }))).toMatchObject({ rank: 1, newBest: false });
    expect(rec(run({ score: 1500 }))).toMatchObject({ rank: 0, newBest: true, previousBest: { score: 1000 } });
    for (let i = 0; i < 5; i++) rec(run({ score: 2000 + i }));
    expect(useProgress.getState().boards.marathon).toHaveLength(5);
    expect(useProgress.getState().boards.marathon![0].score).toBe(2004);
  });

  it('ranks sprint by time and ignores unfinished sprints', () => {
    const rec = useProgress.getState().record;
    expect(rec(run({ mode: 'sprint', lines: 30, reason: 'topout' })).rank).toBe(-1);
    expect(rec(run({ mode: 'sprint', lines: 40, reason: 'goal', completed: true, timeMs: 80_000 })).achievements).toContain('sprint90');
    const r = rec(run({ mode: 'sprint', lines: 40, reason: 'goal', completed: true, timeMs: 70_000 }));
    expect(r).toMatchObject({ rank: 0, newBest: true });
    expect(r.achievements).not.toContain('sprint90');
  });

  it('unlocks achievements and themes once, from lifetime lines', () => {
    const rec = useProgress.getState().record;
    const a = rec(run({ lines: 45, quads: 1 }));
    expect(a.achievements).toEqual(expect.arrayContaining(['first-line', 'quad']));
    expect(a.themes).toEqual(['candy']);
    const b = rec(run({ lines: 5, quads: 1 }));
    expect(b.achievements).not.toContain('quad');
    expect(b.themes).toEqual([]);
  });

  it('counts the daily streak back from today', () => {
    const d = new Date(2026, 9, 19);
    const back = (n: number) => dayKey(new Date(2026, 9, 19 - n));
    expect(dailyStreak({ [back(0)]: 1, [back(1)]: 1, [back(2)]: 1, [back(4)]: 1 }, d)).toBe(3);
    expect(dailyStreak({ [back(1)]: 1, [back(2)]: 1 }, d)).toBe(2);
    expect(dailyStreak({ [back(2)]: 1 }, d)).toBe(0);
  });
});

describe('App', () => {
  it('title → tutorial → countdown, and the tutorial only shows once', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Stackfall' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Play Marathon/ }));
    expect(await screen.findByRole('heading', { name: 'How to play' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Let's go" }));
    expect(useProgress.getState().tutorialDone).toBe(true);
    act(() => useApp.getState().go('title'));
    await userEvent.click(await screen.findByRole('button', { name: /Play Marathon/ }));
    expect(screen.queryByRole('heading', { name: 'How to play' })).not.toBeInTheDocument();
  });

  it('shows personal bests on the mode cards', async () => {
    useProgress.getState().record(run({ score: 4321 }));
    render(<App />);
    expect(screen.getAllByText('Best 4,321').length).toBeGreaterThan(0);
  });

  it('opens progress and selects an unlocked theme', async () => {
    useProgress.setState({ lifetime: { ...useProgress.getState().lifetime, lines: 50 } });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Progress/ }));
    const candy = await screen.findByRole('button', { name: /Candy/ });
    expect(candy).toBeEnabled();
    await userEvent.click(candy);
    expect(useProgress.getState().settings.theme).toBe('candy');
    expect(screen.getByRole('button', { name: /Gilded/ })).toBeDisabled();
  });
});
