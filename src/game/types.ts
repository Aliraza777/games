import type { Vec } from '../lib/math';
import type { Grade } from './scoring/scoring';

export type { Vec };

export type ModeId = 'flick' | 'track' | 'precision' | 'reflex' | 'flow' | 'zen';

export interface StatLine {
  label: string;
  value: string;
}

export interface Histogram {
  label: string;
  values: number[];
  min: number;
  max: number;
  unit: string;
  /** Draw a reference line here (e.g. 0 ms for timing offsets). */
  center?: number;
}

export interface RunResult {
  id: string;
  mode: ModeId;
  date: number;
  seed: number;
  daily: boolean;
  score: number;
  accuracy: number;
  hits: number;
  misses: number;
  perfects: number;
  bestCombo: number;
  avgReaction: number | null;
  rating: number;
  grade: Grade;
  duration: number;
  /** Click offsets relative to target center, normalized by radius. */
  offsets: Vec[];
  offsetsLabel: string;
  histogram: Histogram | null;
  extra: StatLine[];
}

export interface HudState {
  score: number;
  combo: number;
  tier: number;
  /** 0..1 run progress. */
  progress: number;
  timeLeft: number | null;
  accuracy: number | null;
  label: string | null;
  showScore: boolean;
}
