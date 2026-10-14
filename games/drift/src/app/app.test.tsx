import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSpeed } from '../lib/clock';
import { useApp } from '../store/app';
import { useHistory } from '../store/history';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import type { SessionRecord } from '../store/stats';
import { App } from './App';
import { SessionScreen } from './screens/Session';
import { Summary } from './screens/Summary';

const SLOW = { timeout: 4000 };

beforeEach(() => {
  useSettings.setState({ ...DEFAULT_SETTINGS, onboarded: true, reducedMotion: 'on' });
  useApp.setState({ screen: 'home', setupFor: null, session: null });
  useHistory.setState({ sessions: [] });
  setSpeed(1);
});

afterEach(() => setSpeed(1));

describe('first launch', () => {
  it('starts with the one-breath intro, which can be skipped', async () => {
    useSettings.setState({ onboarded: false });
    render(<App />);
    expect(await screen.findByText(/press and hold anywhere/i, undefined, SLOW)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByRole('region', { name: 'Practices' }, SLOW)).toBeInTheDocument();
    expect(useSettings.getState().onboarded).toBe(true);
  });

  it('holding Space walks through the guided breath', async () => {
    useSettings.setState({ onboarded: false });
    setSpeed(40);
    const { container } = render(<App />);
    const intro = await screen.findByText(/press and hold anywhere/i, undefined, SLOW);
    expect(intro).toBeInTheDocument();
    fireEvent.keyDown(window, { key: ' ' });
    await screen.findByText(/let go, and breathe out/i, undefined, SLOW);
    fireEvent.keyUp(window, { key: ' ' });
    await screen.findByText(/that’s the whole game/i, undefined, SLOW);
    expect(container.querySelector('[data-step="done"]')).not.toBeNull();
  });
});

describe('home', () => {
  it('lists every practice with a goal', async () => {
    render(<App />);
    const list = await screen.findByRole('region', { name: 'Practices' }, SLOW);
    for (const name of ['Sigh', 'Tide', 'Box', 'Count', 'Pond']) {
      expect(within(list).getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('“Why it works” reveals the research with real links', async () => {
    render(<App />);
    const list = await screen.findByRole('region', { name: 'Practices' }, SLOW);
    const toggles = within(list).getAllByRole('button', { name: /why it works/i });
    await userEvent.click(toggles[0]);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    const link = await screen.findByRole('link', { name: /balban/i });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^https:\/\//));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('opens a setup sheet that Escape closes', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /^Box:/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: /set up box/i });
    expect(within(dialog).getByText(/keep holding through the pause/i)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts a session with the chosen options', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /^Sigh:/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('radio', { name: '1 min' }));
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Just follow' }));
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Rain' }));
    await userEvent.click(within(dialog).getByRole('radio', { name: /^6$/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: /begin · 1 min/i }));
    expect(useApp.getState().session).toMatchObject({
      practice: 'sigh',
      minutes: 1,
      follow: true,
      soundscape: 'rain',
      tensionBefore: 6,
    });
    // Choices become the new defaults.
    expect(useSettings.getState()).toMatchObject({ follow: true, soundscape: 'rain' });
    expect(await screen.findByLabelText('Time remaining', undefined, SLOW)).toHaveTextContent('1:03');
  });
});

describe('sessions', () => {
  const start = (practice: 'resonance' | 'count' | 'pond', extra = {}) =>
    useApp.getState().startSession({ practice, minutes: 1, soundscape: 'silence', follow: false, tensionBefore: null, ...extra });

  it('a paced session cues each phase and tracks the guide', async () => {
    setSpeed(20);
    start('resonance');
    render(<SessionScreen />);
    expect(await screen.findByTestId('cue')).toHaveTextContent('Breathe in');
    expect(screen.getByTestId('stage')).toHaveAttribute('data-phase', 'inhale');
    await screen.findByText('Breathe out', undefined, SLOW);
    expect(screen.getByTestId('stage')).toHaveAttribute('data-phase', 'exhale');
  });

  it('keeps the screen awake during a session and releases it after (QA D1)', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    start('resonance');
    const { unmount } = render(<SessionScreen />);
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(request).toHaveBeenCalledWith('screen');
    unmount();
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(release).toHaveBeenCalled();
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
  });

  it('Escape pauses and Space continues', async () => {
    start('resonance');
    const { container } = render(<SessionScreen />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(container.querySelector('[data-stage="paused"]')).not.toBeNull();
    fireEvent.keyDown(window, { key: ' ' });
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(container.querySelector('[data-stage="running"]')).not.toBeNull();
  });

  it('counting: taps count up, drifting starts again kindly', async () => {
    setSpeed(60);
    start('count');
    render(<SessionScreen />);
    expect(await screen.findByTestId('count')).toHaveTextContent('Begin at one');
    const breath = async () => {
      await act(() => new Promise((r) => setTimeout(r, 60))); // ~3.6 s of session time
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyUp(window, { key: ' ' });
    };
    await breath();
    await breath();
    await screen.findByText('2 of 9');
    fireEvent.keyDown(window, { key: 'd' });
    expect(await screen.findByText('Begin at one')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/noticing you drifted is the practice/i);
  });

  it('pond: touching the water makes ripples', async () => {
    start('pond');
    render(<SessionScreen />);
    const stage = await screen.findByTestId('stage');
    fireEvent.pointerDown(stage, { clientX: 200, clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    await act(() => new Promise((r) => setTimeout(r, 150)));
    fireEvent.pointerDown(stage, { clientX: 500, clientY: 300, pointerId: 1 });
    expect(stage).toHaveAttribute('data-ripples', '2');
  });
});

describe('summary', () => {
  const outcome = {
    config: { practice: 'sigh' as const, minutes: 1, soundscape: 'waves' as const, follow: false, tensionBefore: 7, nonce: 1 },
    early: false,
    seconds: 63,
    breaths: 7,
    harmony: 0.86,
    cycleScores: [0.9, 0.95, 0.5, 0.88, 0.92, 0.8, 1],
  };

  it('checks out, shows the change in tension and saves the session', async () => {
    render(<Summary outcome={outcome} />);
    await userEvent.click(await screen.findByRole('radio', { name: /^3$/ }));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByTestId('tension-result')).toHaveTextContent(/tension\s*7\s*→\s*3/i);
    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByLabelText('6 of 7 breaths in rhythm')).toBeInTheDocument();
    const saved = useHistory.getState().sessions;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ practice: 'sigh', seconds: 63, tensionBefore: 7, tensionAfter: 3, harmony: 0.86 });
  });

  it("doesn't save very short sessions", async () => {
    useSettings.setState({ checkIns: false });
    render(<Summary outcome={{ ...outcome, seconds: 5, early: true }} />);
    expect(await screen.findByText(/every minute counts/i)).toBeInTheDocument();
    expect(useHistory.getState().sessions).toHaveLength(0);
  });
});

describe('journey & settings', () => {
  it('shows an empty state, then stats once sessions exist', async () => {
    useApp.setState({ screen: 'journey' });
    const { unmount } = render(<App />);
    expect(await screen.findByText(/your path starts with one breath/i, undefined, SLOW)).toBeInTheDocument();
    unmount();

    const now = Date.now();
    const rec = (daysAgo: number): SessionRecord => ({
      id: String(daysAgo),
      practice: 'resonance',
      date: now - daysAgo * 86_400_000,
      seconds: 300,
      tensionBefore: 6,
      tensionAfter: 3,
    });
    useHistory.setState({ sessions: [rec(2), rec(1), rec(0)] });
    render(<App />);
    expect(await screen.findByText('Days in a row', undefined, SLOW)).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // minutes
    expect(screen.getByText('−3.0')).toBeInTheDocument(); // avg tension change
  });

  it('switching theme applies and persists', async () => {
    useApp.setState({ screen: 'settings' });
    render(<App />);
    await userEvent.click(await screen.findByRole('radio', { name: /forest/i }, SLOW));
    expect(document.documentElement.dataset.theme).toBe('forest');
    expect(JSON.parse(localStorage.getItem('drift-settings')!).state.theme).toBe('forest');
  });
});
