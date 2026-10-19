export type ModeId = 'marathon' | 'sprint' | 'ultra' | 'zen' | 'daily';

export interface ModeDef {
  id: ModeId;
  name: string;
  tagline: string;
  /** End the run after this many lines. */
  lineGoal?: number;
  /** End the run after this much time. */
  timeLimitMs?: number;
  /** Level rises every 10 lines. */
  levelUp: boolean;
  /** Topping out clears the well instead of ending the run. */
  noTopOut?: boolean;
  /** How runs are ranked on the personal board. */
  rank: 'score' | 'time';
}

export const MODES: Record<ModeId, ModeDef> = {
  marathon: { id: 'marathon', name: 'Marathon', tagline: '150 lines. Speeds up every 10.', lineGoal: 150, levelUp: true, rank: 'score' },
  sprint: { id: 'sprint', name: 'Sprint', tagline: 'Clear 40 lines as fast as you can.', lineGoal: 40, levelUp: false, rank: 'time' },
  ultra: { id: 'ultra', name: 'Ultra', tagline: 'Two minutes. Highest score wins.', timeLimitMs: 120_000, levelUp: true, rank: 'score' },
  zen: { id: 'zen', name: 'Zen', tagline: 'No pressure, no game over. Just stack.', levelUp: false, noTopOut: true, rank: 'score' },
  daily: { id: 'daily', name: 'Daily', tagline: 'Same pieces for everyone, 3 minutes.', timeLimitMs: 180_000, levelUp: true, rank: 'score' },
};

export const MODE_ORDER: ModeId[] = ['marathon', 'sprint', 'ultra', 'zen'];

/** Local calendar day, e.g. "2026-10-19". */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Stable 32-bit seed from a day key, so the daily sequence is shared. */
export function dailySeed(key = dayKey()): number {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
