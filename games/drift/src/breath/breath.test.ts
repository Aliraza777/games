import { describe, expect, it } from 'vitest';
import { ROUND, countAccuracy, countStep, initialCount, type CountAction, type CountState } from './counter';
import { PATTERNS, breathsPerMinute, cycleLength, expectsHold, inOutSeconds } from './patterns';
import { PRACTICES } from './practices';
import { GRACE, PlayerBreath, SyncTracker } from './sync';
import { TOPUP_BASE, levelAt, phaseAt, phaseLevels, sessionLength } from './timeline';

describe('patterns', () => {
  it('match their protocols', () => {
    expect(cycleLength(PATTERNS.sigh)).toBe(9);
    expect(inOutSeconds(PATTERNS.sigh)).toEqual({ inhale: 3, exhale: 6 }); // exhale twice as long
    expect(breathsPerMinute(PATTERNS.resonance)).toBeCloseTo(5.45, 2); // ~5.5 bpm
    expect(PATTERNS.box.phases.map((p) => p.seconds)).toEqual([4, 4, 4, 4]);
  });

  it('expects a hold only while filling or full', () => {
    expect(['inhale', 'topup', 'hold'].every((k) => expectsHold(k as never))).toBe(true);
    expect(expectsHold('exhale')).toBe(false);
    expect(expectsHold('rest')).toBe(false);
  });

  it('every practice has a source and a sensible default duration', () => {
    for (const p of PRACTICES) {
      expect(p.sources.length).toBeGreaterThan(0);
      expect(p.durations).toContain(p.defaultMinutes);
      for (const s of p.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });
});

describe('timeline', () => {
  const sigh = PATTERNS.sigh;

  it('finds the right phase at boundaries', () => {
    expect(phaseAt(sigh, 0).phase.kind).toBe('inhale');
    expect(phaseAt(sigh, 1.999).phase.kind).toBe('inhale');
    expect(phaseAt(sigh, 2).phase.kind).toBe('topup');
    expect(phaseAt(sigh, 3).phase.kind).toBe('exhale');
    const next = phaseAt(sigh, 9.25);
    expect(next.phase.kind).toBe('inhale');
    expect(next.cycle).toBe(1);
    expect(next.elapsed).toBeCloseTo(0.25);
  });

  it('clamps negative time to the start', () => {
    expect(phaseAt(sigh, -3)).toMatchObject({ index: 0, cycle: 0, elapsed: 0 });
  });

  it('fills, tops up, then empties the lungs', () => {
    expect(phaseLevels(sigh)).toEqual([
      [0, TOPUP_BASE],
      [TOPUP_BASE, 1],
      [1, 0],
    ]);
    expect(levelAt(sigh, 0)).toBeCloseTo(0);
    expect(levelAt(sigh, 2)).toBeCloseTo(TOPUP_BASE);
    expect(levelAt(sigh, 3)).toBeCloseTo(1);
    expect(levelAt(sigh, 8.999)).toBeCloseTo(0, 3);
  });

  it('holds level flat during box holds', () => {
    const box = PATTERNS.box;
    expect(levelAt(box, 5)).toBeCloseTo(1);
    expect(levelAt(box, 7.9)).toBeCloseTo(1);
    expect(levelAt(box, 13)).toBeCloseTo(0);
  });

  it('is continuous — no visual jumps between phases', () => {
    for (const p of Object.values(PATTERNS)) {
      const L = cycleLength(p);
      for (let t = 0.01; t < L * 2; t += 0.01) {
        expect(Math.abs(levelAt(p, t) - levelAt(p, t - 0.01))).toBeLessThan(0.02);
      }
    }
  });

  it('rounds sessions up to whole breaths', () => {
    expect(sessionLength(PATTERNS.sigh, 1)).toBe(63); // 7 × 9s ≥ 60s
    expect(sessionLength(PATTERNS.box, 1)).toBe(64);
    expect(sessionLength(PATTERNS.resonance, 0)).toBe(11); // never zero breaths
    expect(sessionLength(PATTERNS.sigh, 3) % 9).toBe(0);
  });
});

describe('SyncTracker', () => {
  const run = (pattern = PATTERNS.resonance, cycles = 3, input: (t: number) => boolean) => {
    const sync = new SyncTracker();
    const dt = 1 / 60;
    const L = cycleLength(pattern);
    const finished: number[] = [];
    for (let t = 0; t < L * cycles; t += dt) {
      const s = sync.sample(phaseAt(pattern, t), input(t), dt);
      if (s != null) finished.push(s);
    }
    const last = sync.finish();
    if (last != null) finished.push(last);
    return { sync, finished };
  };

  it('scores a perfectly followed breath as full harmony', () => {
    const p = PATTERNS.resonance;
    const { sync, finished } = run(p, 3, (t) => expectsHold(phaseAt(p, t).phase.kind));
    expect(sync.harmony).toBeCloseTo(1, 5);
    expect(finished).toHaveLength(3);
    expect(sync.harmoniousCycles).toBe(3);
  });

  it('scores the opposite of the guide as no harmony', () => {
    const p = PATTERNS.resonance;
    const { sync } = run(p, 2, (t) => !expectsHold(phaseAt(p, t).phase.kind));
    expect(sync.harmony).toBeCloseTo(0, 5);
    expect(sync.harmoniousCycles).toBe(0);
  });

  it('forgives late reactions inside the grace window', () => {
    const p = PATTERNS.box;
    // Player always reacts 0.4s late — inside GRACE, so it shouldn't cost anything.
    const lag = GRACE - 0.1;
    const { sync } = run(p, 2, (t) => expectsHold(phaseAt(p, Math.max(0, t - lag)).phase.kind));
    expect(sync.harmony).toBeGreaterThan(0.99);
  });

  it('returns null harmony before anything is scored', () => {
    expect(new SyncTracker().harmony).toBeNull();
  });
});

describe('PlayerBreath', () => {
  it('fills over the inhale time and empties over the exhale time', () => {
    const b = new PlayerBreath(PATTERNS.sigh); // 3s in, 6s out
    for (let i = 0; i < 150; i++) b.update(true, 0.01);
    expect(b.level).toBeCloseTo(0.5, 2);
    for (let i = 0; i < 300; i++) b.update(true, 0.01);
    expect(b.level).toBe(1);
    for (let i = 0; i < 300; i++) b.update(false, 0.01);
    expect(b.level).toBeCloseTo(0.5, 2);
  });
});

describe('breath counting', () => {
  const apply = (actions: CountAction[], s: CountState = initialCount) =>
    actions.reduce<{ state: CountState; events: string[] }>(
      (acc, a) => {
        const r = countStep(acc.state, a);
        return { state: r.state, events: [...acc.events, r.event] };
      },
      { state: s, events: [] },
    );

  it('completes a round on tap ×8 then close', () => {
    const { state, events } = apply([...Array(ROUND - 1).fill('tap'), 'close']);
    expect(events.at(-1)).toBe('complete');
    expect(state).toMatchObject({ count: 0, correct: 1, miscounts: 0 });
  });

  it('closing early is a gentle miscount that restarts the round', () => {
    const { state, events } = apply(['tap', 'tap', 'close']);
    expect(events.at(-1)).toBe('miscount');
    expect(state).toMatchObject({ count: 0, miscounts: 1 });
  });

  it('tapping the ninth breath overflows', () => {
    const { state, events } = apply(Array(ROUND).fill('tap'));
    expect(events.at(-1)).toBe('overflow');
    expect(state).toMatchObject({ count: 0, miscounts: 1 });
  });

  it('drifting resets without counting as a miss', () => {
    const { state } = apply(['tap', 'tap', 'drift']);
    expect(state).toMatchObject({ count: 0, drifts: 1, miscounts: 0 });
    expect(countAccuracy(state)).toBeNull();
  });

  it('computes accuracy over attempted rounds', () => {
    const round = [...Array(ROUND - 1).fill('tap'), 'close'] as CountAction[];
    const { state } = apply([...round, ...round, 'tap', 'close']);
    expect(countAccuracy(state)).toBeCloseTo(2 / 3);
  });
});
