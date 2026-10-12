import { TAU, clamp, type Rect, type Vec } from '../../lib/math';
import { pick, type Rng } from '../../lib/rng';

export interface ChartNote {
  /** Song time in seconds the note should be hit. */
  time: number;
  x: number;
  y: number;
}

type Pattern = (n: number, i: number) => Vec;

/** Unit-space patterns (roughly -1..1). Each returns the i-th of n points. */
const PATTERNS: Record<string, Pattern> = {
  arc: (n, i) => {
    const a = -Math.PI * 0.1 + (i / Math.max(1, n - 1)) * Math.PI * 1.2;
    return { x: Math.cos(a), y: Math.sin(a) };
  },
  circle: (n, i) => {
    const a = (i / n) * TAU;
    return { x: Math.cos(a), y: Math.sin(a) };
  },
  spiral: (n, i) => {
    const t = i / Math.max(1, n - 1);
    const a = t * TAU * 1.1;
    const r = 0.4 + 0.6 * t;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  },
  zigzag: (n, i) => ({ x: -1 + (2 * i) / Math.max(1, n - 1), y: i % 2 ? 0.55 : -0.55 }),
  star: (_n, i) => {
    const k = (i * 2) % 5;
    const a = -Math.PI / 2 + (k / 5) * TAU;
    return { x: Math.cos(a), y: Math.sin(a) };
  },
  pendulum: (n, i) => ({ x: i % 2 ? 1 : -1, y: -0.8 + (1.6 * i) / Math.max(1, n - 1) }),
};

/**
 * Builds a beat-synced chart: 8-beat phrases, each a shape placed somewhere
 * in the playfield. Density ramps up as the song goes on.
 */
export function buildChart(rng: Rng, opts: { spb: number; songLen: number; field: Rect; radius: number }): ChartNote[] {
  const { spb, songLen, field, radius } = opts;
  const notes: ChartNote[] = [];
  const totalBeats = Math.floor(songLen / spb) - 2;
  const names = Object.keys(PATTERNS);
  const size = Math.max(radius * 3, Math.min(field.w, field.h) * 0.3);

  let beat = 6;
  let phrase = 0;
  let prevCenter: Vec = { x: field.x + field.w / 2, y: field.y + field.h / 2 };
  while (beat + 2 < totalBeats) {
    // Phrase rhythm: half-time to start, then every beat, then some off-beats.
    const offsets =
      phrase < 1
        ? [0, 2, 4, 6]
        : phrase < 3
          ? [0, 1, 2, 3, 4, 5, 6, 7]
          : rng() < 0.5
            ? [0, 1, 1.5, 2, 3, 4, 5, 5.5, 6, 7]
            : [0, 0.5, 1, 2, 3, 3.5, 4, 5, 6, 7];

    const pattern = PATTERNS[pick(rng, names)];
    const rot = rng() * TAU;
    const flip = rng() < 0.5 ? -1 : 1;
    const cx = clamp(
      prevCenter.x + (rng() - 0.5) * field.w * 0.6,
      field.x + size,
      field.x + field.w - size,
    );
    const cy = clamp(
      prevCenter.y + (rng() - 0.5) * field.h * 0.6,
      field.y + size,
      field.y + field.h - size,
    );
    prevCenter = { x: cx, y: cy };

    offsets.forEach((o, i) => {
      if (beat + o >= totalBeats) return;
      const p = pattern(offsets.length, i);
      const px = p.x * flip, py = p.y;
      const x = cx + (px * Math.cos(rot) - py * Math.sin(rot)) * size;
      const y = cy + (px * Math.sin(rot) + py * Math.cos(rot)) * size;
      notes.push({
        time: (beat + o) * spb,
        x: clamp(x, field.x, field.x + field.w),
        y: clamp(y, field.y, field.y + field.h),
      });
    });
    beat += 8;
    phrase++;
  }
  return notes;
}
