/**
 * The seven tetrominoes and Super Rotation System data.
 * Coordinates are (x, y) with y growing DOWN the board.
 */

export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Rot = 0 | 1 | 2 | 3; // spawn, right (cw), 180, left (ccw)
export type Cell = readonly [number, number];

export const PIECES: readonly PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/** Board cell value for each piece type (0 = empty). */
export const CELL_ID: Record<PieceType, number> = { I: 1, J: 2, L: 3, O: 4, S: 5, T: 6, Z: 7 };
export const ID_PIECE: readonly (PieceType | null)[] = [null, 'I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/** Spawn orientation drawn in its bounding box. */
const SHAPES: Record<PieceType, string[]> = {
  I: ['....', 'XXXX', '....', '....'],
  J: ['X..', 'XXX', '...'],
  L: ['..X', 'XXX', '...'],
  O: ['XX', 'XX'],
  S: ['.XX', 'XX.', '...'],
  T: ['.X.', 'XXX', '...'],
  Z: ['XX.', '.XX', '...'],
};

export const BOX_SIZE: Record<PieceType, number> = { I: 4, J: 3, L: 3, O: 2, S: 3, T: 3, Z: 3 };

function parse(rows: string[]): Cell[] {
  const out: Cell[] = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => c === 'X' && out.push([x, y])));
  return out;
}

/** Rotate cells clockwise inside an n×n box. */
const rotCw = (cells: Cell[], n: number): Cell[] => cells.map(([x, y]) => [n - 1 - y, x] as const);

/** SHAPE_CELLS[type][rot] → occupied cells relative to the piece box. */
export const SHAPE_CELLS: Record<PieceType, Cell[][]> = Object.fromEntries(
  PIECES.map((p) => {
    const n = BOX_SIZE[p];
    const states = [parse(SHAPES[p])];
    for (let i = 1; i < 4; i++) states.push(p === 'O' ? states[0] : rotCw(states[i - 1], n));
    return [p, states];
  }),
) as Record<PieceType, Cell[][]>;

// Kick tables from the SRS spec, written with y UP (as published) and flipped below.
type Kicks = Record<string, Cell[]>;
const JLSTZ_UP: Kicks = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const I_UP: Kicks = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
/** 180° kicks (as popularised by modern guideline clones). */
const HALF_UP: Kicks = {
  '0>2': [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]],
  '2>0': [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]],
  '1>3': [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]],
  '3>1': [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]],
};

const flip = (k: Kicks): Kicks => Object.fromEntries(Object.entries(k).map(([key, v]) => [key, v.map(([x, y]) => [x, -y] as const)]));
const JLSTZ = flip(JLSTZ_UP);
const I_KICKS = flip(I_UP);
const HALF = flip(HALF_UP);

/** Kick offsets (y down) to try, in order, when rotating `type` from → to. */
export function kicksFor(type: PieceType, from: Rot, to: Rot): readonly Cell[] {
  if (type === 'O') return [[0, 0]];
  const key = `${from}>${to}`;
  if ((from + 2) % 4 === to) return HALF[key];
  return (type === 'I' ? I_KICKS : JLSTZ)[key];
}

/** Spawn position of the piece box: centred, in the hidden rows above the well. */
export function spawnX(type: PieceType, width: number) {
  return Math.floor((width - BOX_SIZE[type]) / 2);
}
