import { describe, expect, it } from 'vitest';
import {
  comboMultiplier,
  comboTier,
  consistency,
  flickPoints,
  flowPoints,
  gradeFor,
  judge,
  lowerIsBetter,
  precisionPoints,
  reflexPoints,
} from './scoring';
import { dailySeed, mulberry32 } from '../../lib/rng';

describe('combo', () => {
  it('steps tiers at 10 / 25 / 50', () => {
    expect([0, 9, 10, 24, 25, 49, 50, 200].map(comboTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('caps the multiplier at ×2', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(25)).toBe(1.5);
    expect(comboMultiplier(500)).toBe(2);
  });
});

describe('points', () => {
  it('rewards fast, centered flicks more', () => {
    expect(flickPoints(250, 0)).toBeGreaterThan(flickPoints(250, 0.9));
    expect(flickPoints(250, 0.2)).toBeGreaterThan(flickPoints(900, 0.2));
  });

  it('precision is monotonic in offset', () => {
    expect(precisionPoints(0)).toBe(250);
    expect(precisionPoints(1)).toBe(60);
    expect(precisionPoints(0.3)).toBeGreaterThan(precisionPoints(0.6));
  });

  it('reflex points are clamped', () => {
    expect(reflexPoints(100)).toBe(450);
    expect(reflexPoints(5000)).toBe(50);
  });

  it('judges timing windows symmetrically', () => {
    expect(judge(0.03)).toBe('perfect');
    expect(judge(-0.03)).toBe('perfect');
    expect(judge(0.08)).toBe('great');
    expect(judge(-0.15)).toBe('good');
    expect(judge(0.25)).toBe('miss');
    expect(flowPoints('miss', 0)).toBe(0);
    expect(flowPoints('perfect', 0)).toBe(360);
  });
});

describe('ratings', () => {
  it('consistency is 1 for identical values', () => {
    expect(consistency([300, 300, 300])).toBe(1);
    expect(consistency([100, 900, 200, 800])).toBeLessThan(0.5);
  });

  it('lowerIsBetter maps and clamps', () => {
    expect(lowerIsBetter(200, 200, 500)).toBe(1);
    expect(lowerIsBetter(500, 200, 500)).toBe(0);
    expect(lowerIsBetter(1000, 200, 500)).toBe(0);
  });

  it('grades by rating', () => {
    expect([0.95, 0.8, 0.6, 0.1].map(gradeFor)).toEqual(['S', 'A', 'B', 'C']);
  });
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = [a(), a(), a()], sb = [b(), b(), b()];
    expect(sa).toEqual(sb);
    expect(c()).not.toBe(sa[0]);
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true);
  });

  it('daily seed is YYYYMMDD', () => {
    expect(dailySeed(new Date(2026, 9, 12))).toBe(20261012);
  });
});
