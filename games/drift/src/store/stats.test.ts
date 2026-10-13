import { describe, expect, it } from 'vitest';
import { averageTensionDrop, dayKey, recentDays, streak, totalMinutes, type SessionRecord } from './stats';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const rec = (date: number, extra: Partial<SessionRecord> = {}): SessionRecord => ({
  id: String(date),
  practice: 'sigh',
  date,
  seconds: 300,
  ...extra,
});

describe('stats', () => {
  it('keys days by local calendar date', () => {
    expect(dayKey(at(2026, 10, 13, 23))).toBe('2026-10-13');
    expect(dayKey(at(2026, 10, 14, 0))).toBe('2026-10-14');
  });

  it('counts a streak ending today', () => {
    const now = at(2026, 10, 13, 20);
    const records = [rec(at(2026, 10, 11)), rec(at(2026, 10, 12)), rec(at(2026, 10, 13, 8))];
    expect(streak(records, now)).toBe(3);
  });

  it("keeps yesterday's streak alive until you practise today", () => {
    const now = at(2026, 10, 13, 9);
    expect(streak([rec(at(2026, 10, 11)), rec(at(2026, 10, 12))], now)).toBe(2);
  });

  it('breaks on a missed day', () => {
    const now = at(2026, 10, 13);
    expect(streak([rec(at(2026, 10, 10)), rec(at(2026, 10, 13))], now)).toBe(1);
    expect(streak([rec(at(2026, 10, 10))], now)).toBe(0);
    expect(streak([], now)).toBe(0);
  });

  it('handles month boundaries', () => {
    const now = at(2026, 11, 1);
    expect(streak([rec(at(2026, 10, 30)), rec(at(2026, 10, 31)), rec(at(2026, 11, 1))], now)).toBe(3);
  });

  it('sums minutes and buckets recent days', () => {
    const now = at(2026, 10, 13);
    const records = [rec(at(2026, 10, 13)), rec(at(2026, 10, 13, 18), { seconds: 120 }), rec(at(2026, 9, 1))];
    expect(totalMinutes(records)).toBeCloseTo(12);
    const days = recentDays(records, 7, now);
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toEqual({ key: '2026-10-13', minutes: 7 });
    expect(days[0].key).toBe('2026-10-07');
    expect(days.slice(0, -1).every((d) => d.minutes === 0)).toBe(true);
  });

  it('averages tension drop only where both ratings exist', () => {
    const records = [
      rec(1, { tensionBefore: 7, tensionAfter: 3 }),
      rec(2, { tensionBefore: 5, tensionAfter: 4 }),
      rec(3, { tensionBefore: 8, tensionAfter: null }),
    ];
    expect(averageTensionDrop(records)).toBe(2.5);
    expect(averageTensionDrop([rec(4)])).toBeNull();
  });
});
