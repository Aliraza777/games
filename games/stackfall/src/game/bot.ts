import { H, W, collides, dropY, type Piece } from './engine';
import { CELL_ID, SHAPE_CELLS, type PieceType, type Rot } from './pieces';

export interface Placement {
  rot: Rot;
  x: number;
  score: number;
}

/**
 * A small placement AI (classic weighted heuristic) used for the title-screen
 * demo and for headless tests. It drops straight down from spawn.
 */
export function bestPlacement(board: number[][], type: PieceType): Placement | null {
  let best: Placement | null = null;
  for (let rot = 0 as Rot; rot < 4; rot = (rot + 1) as Rot) {
    if (type === 'O' && rot > 0) break;
    for (let x = -2; x < W; x++) {
      const p: Piece = { type, rot, x, y: 0 };
      if (collides(board, p)) continue;
      const y = dropY(board, p);
      const score = evaluate(board, { ...p, y });
      if (!best || score > best.score) best = { rot, x, score };
    }
  }
  return best;
}

function evaluate(board: number[][], p: Piece): number {
  const b = board.map((r) => r.slice());
  for (const [cx, cy] of SHAPE_CELLS[p.type][p.rot]) {
    const y = p.y + cy;
    if (y < 0) return -1e9;
    b[y][p.x + cx] = CELL_ID[p.type];
  }
  const kept = b.filter((r) => !r.every(Boolean));
  const lines = H - kept.length;
  const g = [...Array.from({ length: lines }, () => new Array<number>(W).fill(0)), ...kept];
  const heights = new Array<number>(W).fill(0);
  let holes = 0;
  for (let x = 0; x < W; x++) {
    let seen = false;
    for (let y = 0; y < H; y++) {
      if (g[y][x]) {
        if (!seen) heights[x] = H - y;
        seen = true;
      } else if (seen) holes++;
    }
  }
  const agg = heights.reduce((a, h) => a + h, 0);
  let bump = 0;
  for (let x = 0; x < W - 1; x++) bump += Math.abs(heights[x] - heights[x + 1]);
  const maxH = Math.max(...heights);
  return -0.51 * agg + 0.76 * lines - 0.36 * holes - 0.18 * bump - (maxH > 14 ? (maxH - 14) * 2 : 0);
}

