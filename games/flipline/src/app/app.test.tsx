import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SKINS, STEP } from '../game/config';
import { Game, type RideEvent } from '../game/Game';
import { LEVELS } from '../game/levels';
import { carefulRider } from '../game/sim';
import { useApp } from '../store/app';
import { isUnlocked, nextLevel, totalGems, useProgress } from '../store/progress';
import { App } from './App';

const frame = (g: Game, dt = STEP) => (g as unknown as { frame(dt: number): void }).frame(dt);

function makeGame(levelIndex = 0, tutorial = false) {
  const canvas = document.createElement('canvas');
  const events: RideEvent[] = [];
  const g = new Game(canvas, { level: LEVELS[levelIndex], skin: SKINS[0], tutorial, onEvent: (e) => events.push(e) });
  return { g, events };
}

/** Play like a careful human: one button, pressed and released each frame. */
function ride(g: Game, seconds: number, until?: () => boolean) {
  let held = false;
  for (let t = 0; t < seconds; t += STEP) {
    const want = carefulRider(g.bike);
    if (want && !held) g.press('k:Space');
    if (!want && held) g.release('k:Space');
    held = want;
    frame(g);
    if (until?.()) break;
  }
  if (held) g.release('k:Space');
}

beforeEach(() => {
  useProgress.setState({ levels: {}, skin: 'spark', tutorialDone: false, settings: { sound: 0, music: false, reducedMotion: 'on' } });
  useApp.setState({ screen: 'title', ride: null });
});

describe('Game (one-button integration)', () => {
  it('waits at the start, then rides while held', () => {
    const { g, events } = makeGame(0, true);
    expect(events[0]).toMatchObject({ type: 'hint', id: 'ride' });
    for (let i = 0; i < 60; i++) frame(g);
    expect(g.state).toBe('ready');
    const x0 = g.bike.x;
    g.press('p:1');
    for (let i = 0; i < 90; i++) frame(g);
    expect(g.state).toBe('riding');
    expect(g.bike.x).toBeGreaterThan(x0 + 5);
    expect(events.some((e) => e.type === 'hint-done' && e.id === 'ride')).toBe(true);
    g.destroy();
  });

  it('finishes level 1 collecting every gem, and reports the result', () => {
    const { g, events } = makeGame(0);
    ride(g, 40, () => events.some((e) => e.type === 'finish'));
    for (let i = 0; i < 120 && !events.some((e) => e.type === 'finish'); i++) frame(g);
    const fin = events.find((e) => e.type === 'finish');
    expect(fin).toBeTruthy();
    if (fin?.type !== 'finish') return;
    expect(fin.result).toMatchObject({ levelId: 1, gems: [0, 1, 2], crashes: 0 });
    expect(fin.result.time).toBeGreaterThan(5);
    expect(events.filter((e) => e.type === 'checkpoint').length).toBe(LEVELS[0].pieces.filter((p) => p.t === 'checkpoint').length);
    g.destroy();
  });

  it('crash → slow-mo → a fresh press respawns at the last checkpoint', () => {
    const { g, events } = makeGame(2);
    ride(g, 30, () => g.checkpoint >= 1);
    expect(g.checkpoint).toBe(1);
    // Hold through the air until the helmet hits the track.
    g.press('k:Space');
    for (let i = 0; i < 60 * 20 && g.state !== 'crashed'; i++) frame(g);
    expect(g.state).toBe('crashed');
    expect(events.some((e) => e.type === 'crash')).toBe(true);
    // Still holding the button you crashed with: no instant respawn.
    for (let i = 0; i < 90; i++) frame(g);
    expect(g.state).toBe('crashed');
    g.release('k:Space');
    g.press('k:Space');
    expect(g.state).toBe('ready');
    const cp = g.level.checkpoints[1];
    expect(Math.abs(g.bike.x - cp.x)).toBeLessThan(1.5);
    g.release('k:Space');
    g.destroy();
  });

  it('pause freezes the ride', () => {
    const { g } = makeGame(0);
    g.press('k:KeyA');
    for (let i = 0; i < 60; i++) frame(g);
    g.pause();
    const x = g.bike.x;
    for (let i = 0; i < 60; i++) frame(g);
    expect(g.bike.x).toBe(x);
    g.resume();
    for (let i = 0; i < 30; i++) frame(g);
    expect(g.bike.x).toBeGreaterThan(x);
    g.destroy();
  });

  it('reserved keys (Escape, R) never count as the hold button', () => {
    const { g } = makeGame(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(g.holding).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    expect(g.holding).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }));
    expect(g.holding).toBe(false);
    g.destroy();
  });
});

describe('progress', () => {
  it('unlocks levels in order and skins by gems', () => {
    const p = useProgress.getState();
    expect(isUnlocked({}, 1)).toBe(true);
    expect(isUnlocked({}, 2)).toBe(false);
    expect(nextLevel({})).toBe(1);
    const r = p.complete({ levelId: 1, time: 20, flips: 2, perfects: 1, gems: [0, 2], crashes: 1 });
    expect(r).toMatchObject({ firstClear: true, newGems: 2 });
    let s = useProgress.getState();
    expect(isUnlocked(s.levels, 2)).toBe(true);
    expect(nextLevel(s.levels)).toBe(2);
    // Gems merge across runs; best time keeps the fastest.
    p.complete({ levelId: 1, time: 25, flips: 0, perfects: 0, gems: [1], crashes: 0 });
    s = useProgress.getState();
    expect(s.levels[1]).toMatchObject({ gems: [0, 1, 2], bestTime: 20, bestFlips: 2 });
    expect(totalGems(s.levels)).toBe(3);
    s.setSkin('comet'); // costs 3
    expect(useProgress.getState().skin).toBe('comet');
    s.setSkin('eclipse'); // costs 33 → refused
    expect(useProgress.getState().skin).toBe('comet');
  });
});

describe('screens', () => {
  it('title starts the next unfinished level', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /play level 1/i }));
    expect(useApp.getState()).toMatchObject({ screen: 'ride', ride: { levelId: 1 } });
  });

  it('level grid shows locks and gems', async () => {
    useProgress.getState().complete({ levelId: 1, time: 20, flips: 0, perfects: 0, gems: [0], crashes: 0 });
    useApp.setState({ screen: 'levels' });
    render(<App />);
    expect(await screen.findByRole('button', { name: /level 1: first light, done, 1 of 3 gems/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /level 2: drop in$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /level 3: loop town \(locked\)/i })).toBeDisabled();
  });

  it('garage locks bikes until you have the gems', async () => {
    useApp.setState({ screen: 'garage' });
    render(<App />);
    const comet = await screen.findByRole('radio', { name: /comet — needs 3 gems/i });
    await userEvent.click(comet);
    expect(useProgress.getState().skin).toBe('spark');
    expect(screen.getByRole('radio', { name: 'Spark' })).toHaveAttribute('aria-checked', 'true');
  });

  it('ride screen shows the one-button prompt and HUD', async () => {
    useApp.getState().play(1);
    render(<App />);
    expect(await screen.findByText(/hold the mouse or any key to ride/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. first light/i)).toBeInTheDocument();
    expect(screen.getByTestId('gems')).toHaveTextContent('◆ 0/3');
    await act(() => new Promise((r) => setTimeout(r, 50)));
  });
});
