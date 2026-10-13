import { mean } from '../lib/math';
import type { PracticeId } from '../breath/practices';

export interface SessionRecord {
  id: string;
  practice: PracticeId;
  date: number;
  seconds: number;
  breaths?: number;
  harmony?: number | null;
  tensionBefore?: number | null;
  tensionAfter?: number | null;
  accuracy?: number | null;
  drifts?: number;
}

/** Local calendar day — a 23:30 session and a 00:30 one are different days. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/**
 * Consecutive days with at least one session. Today not practising yet
 * doesn't break the streak — it's still alive until midnight.
 */
export function streak(records: SessionRecord[], now = Date.now()): number {
  const days = new Set(records.map((r) => dayKey(r.date)));
  let cursor = days.has(dayKey(now)) ? now : shiftDay(now, -1);
  let n = 0;
  while (days.has(dayKey(cursor))) {
    n++;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

export function totalMinutes(records: SessionRecord[]): number {
  return records.reduce((s, r) => s + r.seconds, 0) / 60;
}

/** Last `n` days (oldest first) with minutes practised on each. */
export function recentDays(records: SessionRecord[], n = 28, now = Date.now()): { key: string; minutes: number }[] {
  const byDay = new Map<string, number>();
  for (const r of records) byDay.set(dayKey(r.date), (byDay.get(dayKey(r.date)) ?? 0) + r.seconds / 60);
  return Array.from({ length: n }, (_, i) => {
    const key = dayKey(shiftDay(now, i - (n - 1)));
    return { key, minutes: byDay.get(key) ?? 0 };
  });
}

/** Average drop in self-rated tension (0–10) across sessions that recorded both. */
export function averageTensionDrop(records: SessionRecord[]): number | null {
  const drops = records
    .filter((r) => r.tensionBefore != null && r.tensionAfter != null)
    .map((r) => (r.tensionBefore as number) - (r.tensionAfter as number));
  return drops.length ? mean(drops) : null;
}
