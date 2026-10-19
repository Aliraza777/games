import { Bag } from './bag';
import type { ModeDef } from './modes';
import { CELL_ID, SHAPE_CELLS, kicksFor, spawnX, type Cell, type PieceType, type Rot } from './pieces';
import { gravitySeconds, isDifficult, scoreClear, type Spin } from './scoring';

/** Well size: 10 wide, 20 visible rows plus 2 hidden spawn rows on top. */
export const W = 10;
export const H = 22;
export const HIDDEN = 2;
export const LOCK_MS = 500;
export const LOCK_RESETS = 15;
/** Soft-drop factor at or above this means "instant" (sonic) soft drop. */
export const SDF_INSTANT = 41;

export type Action = 'left' | 'right' | 'softDrop' | 'hardDrop' | 'cw' | 'ccw' | 'r180' | 'hold';
export const ACTIONS: Action[] = ['left', 'right', 'softDrop', 'hardDrop', 'cw', 'ccw', 'r180', 'hold'];

export interface Handling {
  /** Delayed auto shift, ms before a held direction starts repeating. */
  das: number;
  /** Auto repeat rate, ms per cell once DAS is charged (0 = instant to the wall). */
  arr: number;
  /** Soft drop speed as a multiple of gravity. */
  sdf: number;
}

export const DEFAULT_HANDLING: Handling = { das: 150, arr: 33, sdf: 20 };

export interface Piece {
  type: PieceType;
  rot: Rot;
  x: number;
  y: number;
}

export type EndReason = 'topout' | 'goal' | 'time' | 'quit';

export interface RunStats {
  score: number;
  lines: number;
  level: number;
  pieces: number;
  timeMs: number;
  quads: number;
  tspins: number;
  tspinDoubles: number;
  tspinTriples: number;
  maxCombo: number;
  maxB2b: number;
  perfectClears: number;
  holds: number;
}

export interface RunResult extends RunStats {
  mode: ModeDef['id'];
  reason: EndReason;
  /** Reached the goal or survived the timer (a topped-out Sprint has no time). */
  completed: boolean;
  pps: number;
  seed: number;
}

export interface ClearEvent {
  type: 'clear';
  rows: number[];
  /** Cell ids of the cleared rows, top to bottom (for effects). */
  cleared: number[][];
  lines: number;
  spin: Spin;
  label: string;
  points: number;
  b2b: boolean;
  /** Consecutive difficult clears, counting this one. */
  b2bChain: number;
  combo: number;
  perfect: boolean;
}

export type EngineEvent =
  | { type: 'spawn'; piece: PieceType }
  | { type: 'move' }
  | { type: 'rotate'; spinReady: boolean }
  | { type: 'hold' }
  | { type: 'softDrop' }
  | { type: 'lock'; cells: Cell[]; piece: PieceType; dropped: number }
  | ClearEvent
  | { type: 'levelUp'; level: number }
  | { type: 'zenClear' }
  | { type: 'end'; result: RunResult };

export interface EngineOptions {
  mode: ModeDef;
  seed: number;
  handling?: Handling;
  startLevel?: number;
  onEvent?: (e: EngineEvent) => void;
}

export const cellsOf = (p: Piece): Cell[] => SHAPE_CELLS[p.type][p.rot].map(([cx, cy]) => [p.x + cx, p.y + cy] as const);

export const emptyBoard = () => Array.from({ length: H }, () => new Array<number>(W).fill(0));

export function collides(board: number[][], p: Piece): boolean {
  for (const [cx, cy] of SHAPE_CELLS[p.type][p.rot]) {
    const x = p.x + cx;
    const y = p.y + cy;
    if (x < 0 || x >= W || y >= H) return true;
    if (y >= 0 && board[y][x]) return true;
  }
  return false;
}

export function dropY(board: number[][], p: Piece): number {
  let y = p.y;
  while (!collides(board, { ...p, y: y + 1 })) y++;
  return y;
}

/** Three-corner T-spin rule; a mini is promoted to full by the long (5th) kick. */
export function detectSpin(board: number[][], p: Piece, kick: number, half: boolean): Spin {
  if (p.type !== 'T') return 'none';
  const cx = p.x + 1;
  const cy = p.y + 1;
  const filled = (x: number, y: number) => x < 0 || x >= W || y >= H || (y >= 0 && board[y][x] !== 0);
  const c = [filled(cx - 1, cy - 1), filled(cx + 1, cy - 1), filled(cx + 1, cy + 1), filled(cx - 1, cy + 1)]; // TL TR BR BL
  if (c.filter(Boolean).length < 3) return 'none';
  const front = [[0, 1], [1, 2], [2, 3], [3, 0]][p.rot];
  if (c[front[0]] && c[front[1]]) return 'full';
  return kick === 4 && !half ? 'full' : 'mini';
}

export class Engine {
  readonly mode: ModeDef;
  readonly seed: number;
  board = emptyBoard();
  active: Piece | null = null;
  hold: PieceType | null = null;
  canHold = true;
  state: 'ready' | 'playing' | 'paused' | 'over' = 'ready';
  stats: RunStats;
  handling: Handling;
  result: RunResult | null = null;
  /** Consecutive difficult clears (0 = no chain). */
  b2bChain = 0;
  combo = -1;

  private bag: Bag;
  private startLevel: number;
  private onEvent: (e: EngineEvent) => void;
  private held = new Set<Action>();
  private dirs: (-1 | 1)[] = [];
  private dasT = 0;
  private arrT = 0;
  private charged = false;
  private grav = 0;
  private lockT = 0;
  private resets = 0;
  private lowestY = 0;
  private lastRotate: { kick: number; half: boolean } | null = null;

  constructor(o: EngineOptions) {
    this.mode = o.mode;
    this.seed = o.seed;
    this.bag = new Bag(o.seed);
    this.handling = o.handling ?? DEFAULT_HANDLING;
    this.startLevel = o.startLevel ?? 1;
    this.onEvent = o.onEvent ?? (() => {});
    this.stats = {
      score: 0, lines: 0, level: this.startLevel, pieces: 0, timeMs: 0, quads: 0, tspins: 0,
      tspinDoubles: 0, tspinTriples: 0, maxCombo: 0, maxB2b: 0, perfectClears: 0, holds: 0,
    };
  }

  get queue(): PieceType[] {
    return this.bag.peek(5);
  }

  get ghostY(): number | null {
    return this.active ? dropY(this.board, this.active) : null;
  }

  /** The stack reaches into the top few visible rows. */
  get danger(): boolean {
    for (let y = 0; y < HIDDEN + 4; y++) if (this.board[y].some(Boolean)) return true;
    return false;
  }

  start() {
    if (this.state !== 'ready') return;
    this.state = 'playing';
    this.spawn();
  }

  pause() {
    if (this.state === 'playing') this.state = 'paused';
    this.releaseAll();
  }

  resume() {
    if (this.state === 'paused') this.state = 'playing';
  }

  quit() {
    if (this.state !== 'over') this.end('quit');
  }

  releaseAll() {
    this.held.clear();
    this.dirs = [];
    this.charged = false;
  }

  isHeld(a: Action) {
    return this.held.has(a);
  }

  press(a: Action) {
    if (this.held.has(a)) return;
    this.held.add(a);
    if (a === 'left' || a === 'right') {
      const d = a === 'left' ? -1 : 1;
      this.dirs = [...this.dirs.filter((x) => x !== d), d];
      this.dasT = 0;
      this.arrT = 0;
      this.charged = false;
    }
    if (this.state !== 'playing' || !this.active) return;
    switch (a) {
      case 'left':
        this.shift(-1);
        break;
      case 'right':
        this.shift(1);
        break;
      case 'softDrop':
        if (this.handling.sdf >= SDF_INSTANT) while (this.stepDown(true));
        else this.stepDown(true);
        this.grav = 0;
        break;
      case 'hardDrop':
        this.hardDrop();
        break;
      case 'cw':
        this.rotate(1);
        break;
      case 'ccw':
        this.rotate(3);
        break;
      case 'r180':
        this.rotate(2);
        break;
      case 'hold':
        this.doHold();
        break;
    }
  }

  release(a: Action) {
    if (!this.held.delete(a)) return;
    if (a === 'left' || a === 'right') {
      const d = a === 'left' ? -1 : 1;
      const top = this.dirs[this.dirs.length - 1];
      this.dirs = this.dirs.filter((x) => x !== d);
      if (top === d) {
        this.dasT = 0;
        this.arrT = 0;
        this.charged = false;
      }
    }
  }

  /** One cell sideways, no auto-repeat (touch drags, tests). */
  shift(dx: -1 | 1): boolean {
    const ok = this.tryMove(dx);
    if (ok) this.emit({ type: 'move' });
    return ok;
  }

  /** One cell down, scored as a soft drop (touch drags). */
  softStep(): boolean {
    const ok = this.stepDown(true);
    if (ok) this.emit({ type: 'softDrop' });
    return ok;
  }

  tick(dt: number) {
    if (this.state !== 'playing') return;
    this.stats.timeMs += dt;
    const limit = this.mode.timeLimitMs;
    if (limit && this.stats.timeMs >= limit) {
      this.stats.timeMs = limit;
      this.end('time');
      return;
    }
    if (!this.active) return;
    this.autoShift(dt);
    if (!this.active) return;

    const g = gravitySeconds(this.stats.level) * 1000;
    const soft = this.held.has('softDrop');
    if (soft && this.handling.sdf >= SDF_INSTANT) {
      while (this.stepDown(true));
    } else {
      this.grav += dt / (soft ? g / Math.max(1, this.handling.sdf) : g);
      let guard = H;
      while (this.grav >= 1 && guard-- > 0) {
        this.grav -= 1;
        if (!this.stepDown(soft)) {
          this.grav = 0;
          break;
        }
      }
    }

    if (this.grounded()) {
      this.lockT += dt;
      if (this.lockT >= LOCK_MS || this.resets >= LOCK_RESETS) this.lock(0);
    } else {
      this.lockT = 0;
    }
  }

  // ── internals ────────────────────────────────────────────────────────

  private emit(e: EngineEvent) {
    this.onEvent(e);
  }

  private grounded(): boolean {
    const p = this.active;
    return !!p && collides(this.board, { ...p, y: p.y + 1 });
  }

  private spawn(type?: PieceType) {
    const t = type ?? this.bag.next();
    const p: Piece = { type: t, rot: 0, x: spawnX(t, W), y: 0 };
    if (collides(this.board, p)) {
      this.active = null;
      this.topOut();
      return;
    }
    if (!collides(this.board, { ...p, y: 1 })) p.y = 1;
    this.active = p;
    this.grav = 0;
    this.lockT = 0;
    this.resets = 0;
    this.lowestY = p.y;
    this.lastRotate = null;
    this.emit({ type: 'spawn', piece: t });
  }

  private topOut() {
    if (this.mode.noTopOut) {
      this.board = emptyBoard();
      this.b2bChain = 0;
      this.combo = -1;
      this.emit({ type: 'zenClear' });
      this.spawn();
      return;
    }
    this.end('topout');
  }

  private afterManeuver(wasGrounded: boolean) {
    const p = this.active!;
    if (p.y > this.lowestY) {
      this.lowestY = p.y;
      this.resets = 0;
      this.lockT = 0;
    } else if (wasGrounded || this.grounded()) {
      if (this.resets < LOCK_RESETS) this.lockT = 0;
      this.resets++;
    }
  }

  private tryMove(dx: number): boolean {
    const p = this.active;
    if (!p) return false;
    const np = { ...p, x: p.x + dx };
    if (collides(this.board, np)) return false;
    const wasGrounded = this.grounded();
    this.active = np;
    this.lastRotate = null;
    this.afterManeuver(wasGrounded);
    return true;
  }

  private stepDown(soft: boolean): boolean {
    const p = this.active;
    if (!p) return false;
    const np = { ...p, y: p.y + 1 };
    if (collides(this.board, np)) return false;
    this.active = np;
    this.lastRotate = null;
    if (soft) this.stats.score += 1;
    if (np.y > this.lowestY) {
      this.lowestY = np.y;
      this.resets = 0;
      this.lockT = 0;
    }
    return true;
  }

  private autoShift(dt: number) {
    const dir = this.dirs[this.dirs.length - 1];
    if (!dir) return;
    const { das, arr } = this.handling;
    if (!this.charged) {
      this.dasT += dt;
      if (this.dasT < das) return;
      this.charged = true;
      this.arrT = this.dasT - das;
      if (arr <= 0) {
        if (this.slide(dir)) this.emit({ type: 'move' });
        return;
      }
      if (this.tryMove(dir)) this.emit({ type: 'move' });
    } else {
      if (arr <= 0) {
        this.slide(dir);
        return;
      }
      this.arrT += dt;
    }
    while (this.arrT >= arr) {
      this.arrT -= arr;
      if (!this.tryMove(dir)) {
        this.arrT = 0;
        break;
      }
      this.emit({ type: 'move' });
    }
  }

  private slide(dir: number): boolean {
    let moved = false;
    while (this.tryMove(dir)) moved = true;
    return moved;
  }

  private rotate(dr: 1 | 2 | 3): boolean {
    const p = this.active;
    if (!p) return false;
    if (p.type === 'O') {
      this.emit({ type: 'rotate', spinReady: false });
      return true;
    }
    const to = ((p.rot + dr) % 4) as Rot;
    const kicks = kicksFor(p.type, p.rot, to);
    for (let i = 0; i < kicks.length; i++) {
      const np: Piece = { ...p, rot: to, x: p.x + kicks[i][0], y: p.y + kicks[i][1] };
      if (collides(this.board, np)) continue;
      const wasGrounded = this.grounded();
      this.active = np;
      this.afterManeuver(wasGrounded);
      this.lastRotate = { kick: i, half: dr === 2 };
      this.emit({ type: 'rotate', spinReady: detectSpin(this.board, np, i, dr === 2) !== 'none' });
      return true;
    }
    return false;
  }

  private hardDrop() {
    const p = this.active!;
    const y = dropY(this.board, p);
    const n = y - p.y;
    if (n > 0) {
      this.active = { ...p, y };
      this.lastRotate = null;
    }
    this.stats.score += 2 * n;
    this.lock(n);
  }

  private doHold() {
    if (!this.canHold || !this.active) return;
    const cur = this.active.type;
    const next = this.hold;
    this.hold = cur;
    this.canHold = false;
    this.stats.holds++;
    this.emit({ type: 'hold' });
    this.spawn(next ?? undefined);
  }

  private lock(dropped: number) {
    const p = this.active!;
    const cells = cellsOf(p);
    const spin = this.lastRotate ? detectSpin(this.board, p, this.lastRotate.kick, this.lastRotate.half) : 'none';
    let lockOut = true;
    for (const [x, y] of cells) {
      if (y >= 0) this.board[y][x] = CELL_ID[p.type];
      if (y >= HIDDEN) lockOut = false;
    }
    this.active = null;
    this.stats.pieces++;

    const rows: number[] = [];
    for (let y = 0; y < H; y++) if (this.board[y].every(Boolean)) rows.push(y);
    const cleared = rows.map((y) => this.board[y].slice());
    if (rows.length) {
      const keep = this.board.filter((_, y) => !rows.includes(y));
      this.board = [...Array.from({ length: rows.length }, () => new Array<number>(W).fill(0)), ...keep];
    }
    const lines = rows.length;
    const perfect = lines > 0 && this.board.every((r) => r.every((c) => !c));
    this.combo = lines > 0 ? this.combo + 1 : -1;

    const s = this.stats;
    const sc = scoreClear({ lines, spin, level: s.level, b2bActive: this.b2bChain > 0, combo: this.combo, perfect });
    if (lines > 0) this.b2bChain = isDifficult(lines, spin) ? this.b2bChain + 1 : 0;
    s.score += sc.points;
    s.lines += lines;
    if (lines === 4) s.quads++;
    if (spin !== 'none' && lines > 0) s.tspins++;
    if (spin === 'full' && lines === 2) s.tspinDoubles++;
    if (spin === 'full' && lines === 3) s.tspinTriples++;
    if (perfect) s.perfectClears++;
    s.maxCombo = Math.max(s.maxCombo, this.combo);
    s.maxB2b = Math.max(s.maxB2b, this.b2bChain - 1);

    this.emit({ type: 'lock', cells, piece: p.type, dropped });
    if (lines > 0 || spin !== 'none') {
      this.emit({
        type: 'clear', rows, cleared, lines, spin, label: sc.label, points: sc.points, b2b: sc.b2b,
        b2bChain: this.b2bChain, combo: Math.max(0, this.combo), perfect,
      });
    }
    if (this.mode.levelUp) {
      const level = Math.min(20, this.startLevel + Math.floor(s.lines / 10));
      if (level > s.level) {
        s.level = level;
        this.emit({ type: 'levelUp', level });
      }
    }
    if (this.mode.lineGoal && s.lines >= this.mode.lineGoal) {
      this.end('goal');
      return;
    }
    this.canHold = true;
    if (lockOut) {
      this.topOut();
      return;
    }
    this.spawn();
  }

  private end(reason: EndReason) {
    this.state = 'over';
    this.active = null;
    this.releaseAll();
    const s = this.stats;
    this.result = {
      ...s,
      mode: this.mode.id,
      reason,
      completed: reason === 'goal' || reason === 'time',
      pps: s.timeMs > 0 ? s.pieces / (s.timeMs / 1000) : 0,
      seed: this.seed,
    };
    this.emit({ type: 'end', result: this.result });
  }
}
