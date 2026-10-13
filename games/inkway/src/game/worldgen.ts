import { clamp, lerp, type Vec } from '../lib/math';
import { mulberry32, type Rng } from '../lib/rng';

export interface Platform {
  id: number;
  /** Top surface, left to right. */
  points: Vec[];
  x0: number;
  x1: number;
}

export interface Gap {
  id: number;
  /** Edge points of the platforms on either side. */
  from: Vec;
  to: Vec;
  kind: 'gap' | 'cliff';
}

export interface Pickup {
  id: number;
  kind: 'ink' | 'star';
  x: number;
  y: number;
}

export interface Updraft {
  id: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  strength: number;
}

export interface Chunk {
  platform: Platform;
  gap: Gap | null;
  pickups: Pickup[];
  updraft: Updraft | null;
}

export const LIMITS = {
  firstRunway: 46,
  firstGap: 7,
  minGap: 4,
  maxGap: 17,
  /** Distance over which difficulty ramps from 0 to 1. */
  rampDistance: 1600,
  step: 2.5,
};

export const difficultyAt = (x: number) => clamp(x / LIMITS.rampDistance, 0, 1);

/**
 * Endless, seeded course: islands of terrain separated by gaps you have to
 * draw across (or cliffs you have to draw a ramp up to).
 */
export class Course {
  private rng: Rng;
  private x = 0;
  private y = 0;
  private index = 0;
  private ids = 0;

  constructor(readonly seed: number) {
    this.rng = mulberry32(seed);
  }

  /** x where the next chunk will start (end of generated terrain). */
  get frontier() {
    return this.x;
  }

  next(): Chunk {
    const r = this.rng;
    const first = this.index === 0;
    const d = difficultyAt(this.x);
    let gap: Gap | null = null;
    let updraft: Updraft | null = null;
    const pickups: Pickup[] = [];

    if (!first) {
      const from = { x: this.x, y: this.y };
      const cliff = this.index > 3 && r() < 0.14 + 0.16 * d;
      let width: number;
      let dy: number;
      if (this.index === 1) {
        // The tutorial gap: level and modest.
        width = LIMITS.firstGap;
        dy = 0;
      } else if (cliff) {
        width = lerp(3, 5, r());
        dy = lerp(3.5, 5 + 2 * d, r());
      } else {
        width = clamp(lerp(5.5, 14, d) * (0.75 + 0.5 * r()), LIMITS.minGap, LIMITS.maxGap);
        dy = lerp(-(2 + 4 * d), 1.5 + 2.5 * d, r());
      }
      this.x += width;
      this.y += dy;
      gap = { id: this.ids++, from, to: { x: this.x, y: this.y }, kind: cliff ? 'cliff' : 'gap' };

      // An ink drop sits on the natural arc over every gap.
      pickups.push({
        id: this.ids++,
        kind: 'ink',
        x: (from.x + this.x) / 2,
        y: Math.max(from.y, this.y) + 1.8 + width * 0.12,
      });
      // Stars hang where only a creative line (bounce!) reaches.
      if (!cliff && r() < 0.35) {
        pickups.push({ id: this.ids++, kind: 'star', x: (from.x + this.x) / 2, y: Math.max(from.y, this.y) + 6 + 3 * r() });
      }
      if (!cliff && d > 0.3 && r() < 0.12) {
        updraft = {
          id: this.ids++,
          x0: from.x + 0.5,
          x1: this.x - 0.5,
          y0: Math.min(from.y, this.y) - 25,
          y1: Math.max(from.y, this.y) + 8,
          strength: 22,
        };
      }
    }

    const length = first ? LIMITS.firstRunway : lerp(38, 18, d) * (0.8 + 0.4 * r());
    const amp = first ? 0 : 0.3 + 1.5 * d;
    const n = Math.max(3, Math.round(length / LIMITS.step));
    const ph1 = r() * 6, ph2 = r() * 6;
    const points: Vec[] = [];
    const base = this.y;
    for (let i = 0; i <= n; i++) {
      const px = this.x + (i / n) * length;
      // Flat lips at both ends make edges readable and landings fair.
      const edge = i <= 1 || i >= n - 1 ? 0 : 1;
      const hill = Math.sin(i * 0.33 + ph1) * 0.65 + Math.sin(i * 0.9 + ph2) * 0.35;
      points.push({ x: px, y: base + edge * amp * hill });
    }
    const platform: Platform = { id: this.ids++, points, x0: this.x, x1: this.x + length };

    if (!first && r() < 0.5) {
      const p = points[Math.floor(points.length / 2)];
      pickups.push({ id: this.ids++, kind: 'star', x: p.x, y: p.y + 4.5 + 2 * r() });
    }
    if (!first && this.index % 3 === 0) {
      const p = points[Math.floor(points.length * 0.7)];
      pickups.push({ id: this.ids++, kind: 'ink', x: p.x, y: p.y + 1.6 });
    }

    this.x += length;
    this.y = points[points.length - 1].y;
    this.index++;
    return { platform, gap, pickups, updraft };
  }
}
