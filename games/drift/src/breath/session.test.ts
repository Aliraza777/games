import { describe, expect, it } from 'vitest';
import { PATTERNS, cycleLength, expectsHold } from './patterns';
import { CountSession, HOLD_TO_CLOSE, PacedSession } from './session';
import { MIN_BREATH_GAP, ROUND } from './counter';

const DT = 1 / 60;

describe('PacedSession', () => {
  it('runs whole breaths and finishes exactly once', () => {
    const s = new PacedSession(PATTERNS.sigh, 1, false);
    expect(s.total).toBe(63);
    expect(s.cycles).toBe(7);
    let doneSteps = 0;
    let phaseChanges = 0;
    while (doneSteps < 3) {
      const peek = s.update(0); // read the current phase without advancing time
      if (peek.phaseChanged) phaseChanges++;
      s.held = expectsHold(peek.state.phase.kind);
      const step = s.update(DT);
      if (step.phaseChanged) phaseChanges++;
      if (step.done) doneSteps++;
    }
    expect(s.t).toBe(63);
    expect(s.breaths).toBe(7);
    expect(s.sync.cycleScores).toHaveLength(7);
    expect(s.harmony).toBeGreaterThan(0.98);
    expect(phaseChanges).toBe(7 * 3); // three phases per sigh
  });

  it('follow mode needs no input and has no harmony score', () => {
    const s = new PacedSession(PATTERNS.resonance, 1, true);
    const scores: number[] = [];
    while (!s.done) {
      const step = s.update(DT);
      expect(step.player).toBeNull();
      if (step.cycleScore != null) scores.push(step.cycleScore);
    }
    expect(s.harmony).toBeNull();
    expect(scores).toHaveLength(s.cycles);
    expect(scores.every((x) => x === 1)).toBe(true);
  });

  it("an idle player doesn't get credit for holds", () => {
    const s = new PacedSession(PATTERNS.box, 1, false);
    while (!s.done) s.update(DT);
    // Released the whole time: only exhale/rest match → about half.
    expect(s.harmony).toBeGreaterThan(0.4);
    expect(s.harmony).toBeLessThan(0.6);
  });

  it('ends on a fully exhaled guide', () => {
    const s = new PacedSession(PATTERNS.resonance, 1, true);
    let last = s.update(0);
    while (!s.done) last = s.update(0.5);
    expect(last.guide).toBeCloseTo(0, 3);
    expect(last.state.phase.kind).toBe('exhale');
  });

  it('progress goes 0 → 1', () => {
    const s = new PacedSession(PATTERNS.sigh, 1, true);
    expect(s.progress).toBe(0);
    s.update(cycleLength(PATTERNS.sigh) * 3.5);
    expect(s.progress).toBeCloseTo(31.5 / 63);
  });
});

describe('CountSession', () => {
  const breathe = (s: CountSession, gap = 1.2) => {
    s.update(gap);
    s.press();
    s.update(0.15);
    return s.release();
  };
  const closeByHold = (s: CountSession) => {
    s.update(1.2);
    s.press();
    const results = [];
    for (let i = 0; i < 60; i++) results.push(s.update(0.02));
    results.push(s.release());
    return results.filter(Boolean);
  };

  it('a short press is a tap, a long press closes the circle', () => {
    const s = new CountSession(5);
    for (let i = 0; i < ROUND - 1; i++) expect(breathe(s)).toBe('count');
    expect(s.state.count).toBe(8);
    expect(closeByHold(s)).toEqual(['complete']); // closes once, release does nothing more
    expect(s.state).toMatchObject({ count: 0, correct: 1 });
  });

  it('shows hold progress while pressing', () => {
    const s = new CountSession(5);
    s.update(2);
    s.press();
    s.update(HOLD_TO_CLOSE / 2);
    expect(s.holdProgress).toBeCloseTo(0.5);
    s.release();
    expect(s.holdProgress).toBeNull();
  });

  it('ignores taps faster than a breath', () => {
    const s = new CountSession(5);
    expect(breathe(s)).toBe('count');
    expect(breathe(s, MIN_BREATH_GAP / 3)).toBe('too-fast');
    expect(s.state.count).toBe(1);
  });

  it('drift resets the round and is always allowed', () => {
    const s = new CountSession(5);
    breathe(s);
    breathe(s);
    expect(s.drift()).toBe('drift');
    expect(s.state).toMatchObject({ count: 0, drifts: 1 });
  });

  it('finishes at its duration', () => {
    const s = new CountSession(1);
    s.update(59);
    expect(s.done).toBe(false);
    s.update(5);
    expect(s.done).toBe(true);
    expect(s.t).toBe(60);
  });
});
