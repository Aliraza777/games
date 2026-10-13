// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TAU } from '../lib/math';
import { INKS, INK_ORDER, NO_DRAW_RADIUS, SAMPLE_SPACING, TANK } from './config';
import { InkTank, StrokeBuilder, cycleInk, distToStroke, forwardOrder, strokeCost } from './ink';
import { AIR_GRACE, TrickTracker } from './tricks';
import { Course, LIMITS, difficultyAt } from './worldgen';

describe('world generator', () => {
  const chunks = (seed: number, n: number) => {
    const c = new Course(seed);
    return Array.from({ length: n }, () => c.next());
  };

  it('is deterministic per seed', () => {
    expect(chunks(42, 30)).toEqual(chunks(42, 30));
    expect(chunks(42, 5)).not.toEqual(chunks(43, 5));
  });

  it('opens with a flat runway and a gentle tutorial gap', () => {
    const [first, second] = chunks(7, 2);
    expect(first.gap).toBeNull();
    expect(first.platform.x1 - first.platform.x0).toBe(LIMITS.firstRunway);
    expect(first.platform.points.every((p) => p.y === 0)).toBe(true);
    expect(second.gap!.to.x - second.gap!.from.x).toBe(LIMITS.firstGap);
    expect(second.gap!.to.y).toBe(second.gap!.from.y);
  });

  it('keeps every gap crossable and platforms in order', () => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      const cs = chunks(seed, 120);
      let lastX1 = -Infinity;
      for (const c of cs) {
        expect(c.platform.x0).toBeGreaterThanOrEqual(lastX1);
        lastX1 = c.platform.x1;
        if (!c.gap) continue;
        const w = c.gap.to.x - c.gap.from.x;
        expect(w).toBeGreaterThanOrEqual(c.gap.kind === 'cliff' ? 3 : LIMITS.minGap);
        expect(w).toBeLessThanOrEqual(LIMITS.maxGap);
        // A bridge across any gap fits in one tank of road ink.
        expect(Math.hypot(w, c.gap.to.y - c.gap.from.y) * INKS.road.cost).toBeLessThan(TANK.max * 0.5);
        // Every gap carries an ink drop, so the economy can't strand you.
        expect(c.pickups.some((p) => p.kind === 'ink')).toBe(true);
      }
    }
  });

  it('gets harder with distance', () => {
    expect(difficultyAt(0)).toBe(0);
    expect(difficultyAt(LIMITS.rampDistance * 2)).toBe(1);
    const cs = chunks(5, 160).filter((c) => c.gap?.kind === 'gap');
    const avg = (xs: typeof cs) => xs.reduce((s, c) => s + (c.gap!.to.x - c.gap!.from.x), 0) / xs.length;
    const early = cs.filter((c) => c.gap!.from.x < 500);
    const late = cs.filter((c) => c.gap!.from.x > 1600);
    expect(avg(late)).toBeGreaterThan(avg(early) + 2);
  });

  it('adds cliffs that need a ramp, later on', () => {
    const cliffs = chunks(11, 200).filter((c) => c.gap?.kind === 'cliff');
    expect(cliffs.length).toBeGreaterThan(5);
    for (const c of cliffs) expect(c.gap!.to.y - c.gap!.from.y).toBeGreaterThan(3);
  });
});

describe('ink', () => {
  it('tank spends per ink type and clamps', () => {
    const t = new InkTank(100);
    expect(t.spend('road', 10)).toBe(10);
    expect(t.level).toBe(90);
    expect(t.spend('boost', 10)).toBe(10);
    expect(t.level).toBe(70);
    expect(t.spend('boost', 100)).toBe(35);
    expect(t.level).toBe(0);
    t.refill(500);
    expect(t.level).toBe(100);
  });

  it('samples strokes evenly and charges for them', () => {
    const t = new InkTank(100);
    const s = new StrokeBuilder('road', t);
    expect(s.add({ x: 0, y: 0 }, null)).toBe('added');
    expect(s.add({ x: SAMPLE_SPACING / 2, y: 0 }, null)).toBe('too-close');
    expect(s.add({ x: 10, y: 0 }, null)).toBe('added');
    expect(s.points.length).toBeGreaterThan(4); // the fast flick was filled in
    expect(s.length).toBeCloseTo(10);
    expect(t.level).toBeCloseTo(90);
  });

  it('refuses to draw through your own vehicle', () => {
    const s = new StrokeBuilder('road', new InkTank());
    const car = { x: 5, y: 0 };
    expect(s.add({ x: 5, y: NO_DRAW_RADIUS / 2 }, car)).toBe('blocked');
    expect(s.add({ x: 0, y: 0 }, car)).toBe('added');
    // A flick straight through the car is cut short.
    expect(s.add({ x: 10, y: 0 }, car)).toBe('blocked');
    expect(s.points.every((p) => Math.hypot(p.x - car.x, p.y - car.y) >= NO_DRAW_RADIUS)).toBe(true);
  });

  it('stops exactly when the ink runs out', () => {
    const t = new InkTank(100, 5);
    const s = new StrokeBuilder('road', t);
    s.add({ x: 0, y: 0 }, null);
    expect(s.add({ x: 20, y: 0 }, null)).toBe('empty');
    expect(s.length).toBeCloseTo(5);
    expect(t.level).toBe(0);
    expect(new StrokeBuilder('road', t).add({ x: 0, y: 0 }, null)).toBe('empty');
  });

  it('unlimited strokes (attract mode) cost nothing', () => {
    const t = new InkTank(100, 0);
    const s = new StrokeBuilder('boost', t, true);
    s.add({ x: 0, y: 0 }, null);
    expect(s.add({ x: 30, y: 0 }, null)).toBe('added');
    expect(t.level).toBe(0);
  });

  it('helpers: cost, hit testing, ordering, cycling', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(strokeCost(pts, 'bounce')).toBeCloseTo(16);
    expect(distToStroke({ x: 5, y: 2 }, pts)).toBeCloseTo(2);
    expect(forwardOrder([...pts].reverse())[0].x).toBe(0);
    expect(cycleInk('boost', 1, INK_ORDER)).toBe('road');
    expect(cycleInk('road', -1, INK_ORDER)).toBe('boost');
  });
});

describe('tricks', () => {
  const fly = (t: TrickTracker, turns: number, seconds = 1.2) => {
    const steps = 60;
    let angle = 0;
    t.update(1 / 60, angle, true);
    for (let i = 0; i < steps; i++) {
      angle += (turns * TAU) / steps;
      t.update(seconds / steps, angle, false);
    }
    return t.update(1 / 60, angle, true);
  };

  it('counts a backflip (unwrapping past ±π)', () => {
    const landing = fly(new TrickTracker(), 1);
    expect(landing).toMatchObject({ flips: 1, direction: 'back', ink: TANK.flipRefill });
  });

  it('counts double frontflips', () => {
    expect(fly(new TrickTracker(), -2.05)).toMatchObject({ flips: 2, direction: 'front', label: 'Frontflip ×2' });
  });

  it('a nearly complete rotation still counts; a half turn does not', () => {
    expect(fly(new TrickTracker(), 0.85)?.flips).toBe(1);
    expect(fly(new TrickTracker(), 0.5, 0.5)).toBeNull();
  });

  it('long hang time is "big air" even without flipping', () => {
    expect(fly(new TrickTracker(), 0, 1.8)).toMatchObject({ flips: 0, bigAir: true, label: 'Big air' });
  });

  it('small bumps are not airtime', () => {
    const t = new TrickTracker();
    t.update(1 / 60, 0, true);
    t.update(AIR_GRACE / 2, 0, false);
    expect(t.isAirborne).toBe(false);
    expect(t.update(1 / 60, 0, true)).toBeNull();
  });

  it('chains tricks into a combo multiplier', () => {
    const t = new TrickTracker();
    const a = fly(t, 1)!;
    const b = fly(t, 1)!;
    expect(b.combo).toBe(a.combo + 1);
    expect(b.points).toBe(a.points * 2);
    t.reset();
    expect(t.combo).toBe(0);
  });
});
