import type { Vec } from '../lib/math';

/** A tiny track language: levels are written as a list of pieces. */
export type Piece =
  | { t: 'flat'; len: number }
  | { t: 'slope'; len: number; rise: number }
  | { t: 'ramp'; len: number; rise: number }
  | { t: 'hill'; len: number; height: number }
  | { t: 'gap'; len: number; drop?: number }
  | { t: 'loop'; r: number }
  | { t: 'checkpoint' }
  | { t: 'gem'; dx: number; dy: number }
  | { t: 'finish' };

export interface LoopDef {
  id: number;
  cx: number;
  cy: number;
  r: number;
}

export interface BuiltLevel {
  /** Continuous track lines (split at gaps), each left → right. */
  lines: Vec[][];
  loops: LoopDef[];
  /** Respawn points, in order; the first is the start. */
  checkpoints: Vec[];
  gems: Vec[];
  finishX: number;
  /** Lowest track point — below this (minus a margin) is the void. */
  floor: number;
}

export interface LevelDef {
  id: number;
  name: string;
  /** Neon track color for this level. */
  color: string;
  glow: string;
  pieces: Piece[];
}

const STEP = 1;
/** Flat run-up after every checkpoint (m). */
export const CHECKPOINT_RUNUP = 22;

/** Turn pieces into geometry. Pure and deterministic — tested for every level. */
export function buildLevel(pieces: Piece[]): BuiltLevel {
  const lines: Vec[][] = [];
  const loops: LoopDef[] = [];
  const checkpoints: Vec[] = [{ x: 3, y: 0 }];
  const gems: Vec[] = [];
  let line: Vec[] = [{ x: -12, y: 0 }];
  let x = 0;
  let y = 0;
  let finishX = Infinity;
  let floor = 0;
  const push = (px: number, py: number) => {
    line.push({ x: px, y: py });
    floor = Math.min(floor, py);
  };
  push(0, 0);

  const curve = (len: number, f: (t: number) => number) => {
    const n = Math.max(2, Math.round(len / STEP));
    const y0 = y;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      push(x + len * t, y0 + f(t));
    }
    x += len;
    y = line[line.length - 1].y;
  };

  for (const p of pieces) {
    switch (p.t) {
      case 'flat':
        curve(p.len, () => 0);
        break;
      case 'slope':
        // Smooth S-curve: no kinks to snag the wheels.
        curve(p.len, (t) => (p.rise * (1 - Math.cos(Math.PI * t))) / 2);
        break;
      case 'ramp':
        // Kicker: gets steeper towards the lip so it launches you.
        curve(p.len, (t) => p.rise * t * t);
        break;
      case 'hill':
        curve(p.len, (t) => p.height * Math.sin(Math.PI * t) ** 2);
        break;
      case 'gap': {
        lines.push(line);
        x += p.len;
        y -= p.drop ?? 0;
        line = [];
        push(x, y);
        break;
      }
      case 'loop': {
        // Ground runs straight under the loop; the circle sits on it, tangent at the bottom.
        const run = p.r * 2 + 6;
        loops.push({ id: loops.length, cx: x + 3 + p.r, cy: y + p.r, r: p.r });
        curve(run, () => 0);
        break;
      }
      case 'checkpoint':
        // You respawn at rest — give every checkpoint a run-up before the next feature.
        checkpoints.push({ x, y });
        curve(CHECKPOINT_RUNUP, () => 0);
        break;
      case 'gem':
        gems.push({ x: x + p.dx, y: y + p.dy });
        break;
      case 'finish':
        finishX = x;
        curve(40, () => 0); // run-out
        break;
    }
  }
  lines.push(line);
  return { lines, loops, checkpoints, gems, finishX, floor };
}

const L = {
  flat: (len: number): Piece => ({ t: 'flat', len }),
  slope: (len: number, rise: number): Piece => ({ t: 'slope', len, rise }),
  ramp: (len: number, rise: number): Piece => ({ t: 'ramp', len, rise }),
  hill: (len: number, height: number): Piece => ({ t: 'hill', len, height }),
  gap: (len: number, drop = 0): Piece => ({ t: 'gap', len, drop }),
  loop: (r: number): Piece => ({ t: 'loop', r }),
  cp: (): Piece => ({ t: 'checkpoint' }),
  gem: (dx: number, dy: number): Piece => ({ t: 'gem', dx, dy }),
  finish: (): Piece => ({ t: 'finish' }),
};
const { flat, slope, ramp, hill, gap, loop, cp, gem, finish } = L;

/** A jump: kicker, gap, and a downhill landing so flips land smoothly. */
const jump = (rampLen: number, rise: number, gapLen: number, drop: number, land = 14): Piece[] => [
  ramp(rampLen, rise),
  gap(gapLen, drop),
  slope(land, -Math.min(4, drop * 0.4 + 1.5)),
];

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'First Light',
    color: '#3df2ff',
    glow: '#0a4a5a',
    pieces: [flat(30), hill(20, 2), gem(-10, 4.5), flat(12), gem(4, 4), ...jump(10, 2.2, 6, 1), flat(16), cp(), hill(18, 2.5), flat(10), gem(5, 5), ...jump(12, 3, 8, 2), flat(14), slope(20, -3), flat(10), finish()],
  },
  {
    id: 2,
    name: 'Drop In',
    color: '#ffd23f',
    glow: '#5a4a0a',
    pieces: [flat(26), slope(20, -4), flat(10), ...jump(10, 2.5, 8, 3), gem(-6, 5), flat(14), cp(), slope(18, -3), hill(16, 2), ...jump(12, 3, 10, 4), gem(-8, 6), flat(14), cp(), slope(24, -5), flat(8), gem(4, 3), ...jump(10, 2.5, 8, 2), flat(12), finish()],
  },
  {
    id: 3,
    name: 'Loop Town',
    color: '#ff4fd8',
    glow: '#5a0a4a',
    pieces: [flat(40), loop(3.4), gem(-7, 6), flat(20), cp(), hill(18, 2), gem(-9, 4.5), flat(30), loop(3.6), flat(16), ...jump(10, 2.8, 8, 2), gem(-6, 6), flat(14), finish()],
  },
  {
    id: 4,
    name: 'Kickers',
    color: '#9eff3d',
    glow: '#2a5a0a',
    pieces: [flat(30), ...jump(10, 3, 9, 2), flat(10), ...jump(10, 3.2, 10, 2.5), gem(-5, 7), flat(12), cp(), ...jump(12, 3.5, 11, 3), flat(10), ...jump(10, 3, 9, 2), gem(-4, 6), flat(12), cp(), ...jump(14, 4, 12, 4), gem(-6, 8), flat(14), finish()],
  },
  {
    id: 5,
    name: 'Rollers',
    color: '#ff8a3d',
    glow: '#5a2a0a',
    pieces: [flat(26), hill(14, 2), hill(14, 2.5), hill(14, 3), gem(-7, 6), flat(10), cp(), slope(16, -3), hill(12, 2), hill(12, 2), ...jump(12, 3, 9, 2), gem(-5, 6), flat(12), cp(), hill(16, 3.5), hill(16, 3.5), gem(-8, 7), flat(12), finish()],
  },
  {
    id: 6,
    name: 'Double Loop',
    color: '#8f6bff',
    glow: '#2a0a5a',
    pieces: [flat(40), loop(3.4), flat(14), loop(3.4), gem(-7, 6), flat(18), cp(), ...jump(12, 3, 10, 2), flat(30), loop(3.6), gem(-8, 6), flat(14), gem(4, 5), ...jump(10, 3, 9, 2), flat(12), finish()],
  },
  {
    id: 7,
    name: 'Canyon',
    color: '#ff5a4d',
    glow: '#5a0a0a',
    pieces: [flat(30), ...jump(12, 3.5, 12, 4), gem(-8, 7), flat(12), cp(), slope(16, -3), ...jump(12, 3.5, 13, 5), flat(10), cp(), ...jump(14, 4, 14, 5), gem(-9, 8), flat(12), cp(), ...jump(12, 3.5, 12, 4), gem(-7, 7), flat(14), finish()],
  },
  {
    id: 8,
    name: 'Stairway',
    color: '#3dff9e',
    glow: '#0a5a2a',
    pieces: [flat(30), slope(14, 2.5), flat(8), slope(14, 2.5), flat(8), gem(4, 3), slope(14, 2.5), flat(14), cp(), ...jump(12, 3, 10, 1), flat(8), slope(14, 3), flat(10), gem(5, 4), ...jump(12, 3.5, 11, 3), flat(12), cp(), slope(16, 3), flat(10), ...jump(14, 4, 12, 4), gem(-7, 8), flat(14), finish()],
  },
  {
    id: 9,
    name: 'Loop & Leap',
    color: '#ffe14d',
    glow: '#5a5a0a',
    pieces: [flat(40), loop(3.5), flat(10), ...jump(12, 3.2, 10, 2.5), gem(-6, 6), flat(30), cp(), loop(3.6), flat(10), ...jump(12, 3.5, 11, 3), gem(-7, 7), flat(14), cp(), flat(20), loop(3.6), gem(-8, 6), flat(12), ...jump(10, 3, 9, 2), flat(12), finish()],
  },
  {
    id: 10,
    name: 'Night Shift',
    color: '#c8d0ff',
    glow: '#2a2a5a',
    pieces: [flat(30), hill(16, 3), slope(14, -3), ...jump(12, 3.5, 11, 3), gem(-6, 7), flat(12), cp(), flat(26), loop(3.6), flat(10), hill(14, 2.5), gem(-7, 5), ...jump(12, 3.5, 12, 3), flat(12), cp(), slope(18, -4), ...jump(14, 4, 13, 4), gem(-8, 8), flat(14), finish()],
  },
  {
    id: 11,
    name: 'Gauntlet',
    color: '#ff4f6d',
    glow: '#5a0a1a',
    pieces: [flat(40), loop(3.5), flat(12), loop(3.5), flat(10), ...jump(12, 3.5, 11, 3), gem(-6, 7), flat(14), cp(), ...jump(12, 3.5, 12, 3), flat(10), hill(14, 3), gem(-7, 6), flat(26), loop(3.6), flat(10), cp(), ...jump(14, 4, 13, 4), flat(10), ...jump(12, 3.5, 12, 3), gem(-6, 7), flat(14), finish()],
  },
  {
    id: 12,
    name: 'Finale',
    color: '#ffffff',
    glow: '#3a3a3a',
    pieces: [flat(40), loop(3.5), flat(12), ...jump(12, 3.5, 12, 3), gem(-6, 7), flat(12), cp(), hill(16, 3), slope(16, -4), ...jump(14, 4, 14, 4), flat(26), loop(3.7), flat(10), cp(), slope(16, 3), flat(8), ...jump(14, 4, 13, 4), gem(-7, 8), flat(26), loop(3.6), flat(12), cp(), ...jump(14, 4.2, 14, 5), gem(-8, 9), flat(16), finish()],
  },
];

export const levelById = (id: number) => LEVELS.find((l) => l.id === id)!;
export const GEMS_PER_LEVEL = LEVELS.map((l) => l.pieces.filter((p) => p.t === 'gem').length);
export const TOTAL_GEMS = GEMS_PER_LEVEL.reduce((a, b) => a + b, 0);
