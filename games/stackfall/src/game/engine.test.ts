import { describe, expect, it } from 'vitest';
import { Bag } from './bag';
import { bestPlacement } from './bot';
import { Engine, H, LOCK_MS, W, cellsOf, detectSpin, emptyBoard, type EngineEvent, type Piece } from './engine';
import { MODES, dailySeed, type ModeId } from './modes';
import { PIECES, SHAPE_CELLS, kicksFor } from './pieces';
import { gravitySeconds, scoreClear } from './scoring';

const STEP = 1000 / 60;

function make(mode: ModeId = 'marathon', seed = 1, handling = { das: 150, arr: 33, sdf: 20 }) {
  const events: EngineEvent[] = [];
  const e = new Engine({ mode: MODES[mode], seed, handling, onEvent: (ev) => events.push(ev) });
  e.start();
  return { e, events };
}

const tap = (e: Engine, a: Parameters<Engine['press']>[0]) => {
  e.press(a);
  e.release(a);
};

/** Rows written top→bottom as strings, aligned to the bottom of the well. */
function setBottom(e: Engine, rows: string[]) {
  e.board = emptyBoard();
  rows.forEach((r, i) => {
    const y = H - rows.length + i;
    [...r].forEach((c, x) => (e.board[y][x] = c === 'X' ? 8 : 0));
  });
}

/** Play one piece with the bot using real inputs. */
function botMove(e: Engine) {
  const p = e.active!;
  const plan = bestPlacement(e.board, p.type)!;
  for (let i = 0; i < plan.rot; i++) tap(e, 'cw');
  const dx = plan.x - e.active!.x;
  for (let i = 0; i < Math.abs(dx); i++) tap(e, dx < 0 ? 'left' : 'right');
  tap(e, 'hardDrop');
  e.tick(STEP);
}

describe('pieces', () => {
  it('every orientation has four cells', () => {
    for (const p of PIECES) for (const s of SHAPE_CELLS[p]) expect(s).toHaveLength(4);
  });
  it('T rotates clockwise to point right', () => {
    expect(SHAPE_CELLS.T[1]).toEqual(expect.arrayContaining([[1, 0], [1, 1], [2, 1], [1, 2]]));
  });
  it('I kick tables are flipped to y-down', () => {
    expect(kicksFor('I', 0, 1)[4]).toEqual([1, -2]);
    expect(kicksFor('T', 0, 1)[2]).toEqual([-1, -1]);
  });
});

describe('7-bag', () => {
  it('deals each piece once per bag', () => {
    const b = new Bag(42);
    for (let i = 0; i < 20; i++) {
      const seven = Array.from({ length: 7 }, () => b.next());
      expect(new Set(seven).size).toBe(7);
    }
  });
  it('is deterministic per seed', () => {
    const a = new Bag(7).peek(21);
    expect(new Bag(7).peek(21)).toEqual(a);
    expect(new Bag(8).peek(21)).not.toEqual(a);
  });
  it('daily seed is stable per day', () => {
    expect(dailySeed('2026-10-19')).toBe(dailySeed('2026-10-19'));
    expect(dailySeed('2026-10-19')).not.toBe(dailySeed('2026-10-20'));
  });
});

describe('scoring', () => {
  const base = { level: 1, b2bActive: false, combo: 0, perfect: false };
  it('uses the guideline line table', () => {
    expect([1, 2, 3, 4].map((lines) => scoreClear({ ...base, lines, spin: 'none' }).points)).toEqual([100, 300, 500, 800]);
  });
  it('scores T-spins, back-to-back, combos and perfect clears', () => {
    expect(scoreClear({ ...base, lines: 2, spin: 'full' }).points).toBe(1200);
    expect(scoreClear({ ...base, lines: 4, spin: 'none', b2bActive: true }).points).toBe(1200);
    expect(scoreClear({ ...base, lines: 1, spin: 'none', b2bActive: true }).b2b).toBe(false);
    expect(scoreClear({ ...base, lines: 1, spin: 'none', combo: 3, level: 2 }).points).toBe(200 + 300);
    expect(scoreClear({ ...base, lines: 4, spin: 'none', perfect: true }).points).toBe(800 + 2000);
    expect(scoreClear({ ...base, lines: 2, spin: 'full' }).label).toBe('T-SPIN DOUBLE');
  });
  it('gravity speeds up with level', () => {
    expect(gravitySeconds(1)).toBe(1);
    expect(gravitySeconds(10)).toBeLessThan(gravitySeconds(5));
    expect(gravitySeconds(20)).toBeLessThan(0.001);
  });
});

describe('engine', () => {
  it('spawns centred and falls with gravity', () => {
    const { e, events } = make();
    expect(events[0]).toMatchObject({ type: 'spawn' });
    const y0 = e.active!.y;
    for (let i = 0; i < 61; i++) e.tick(STEP);
    expect(e.active!.y).toBe(y0 + 1);
  });

  it('hard drops, scores 2/cell and spawns the next piece from the queue', () => {
    const { e } = make();
    const next = e.queue[0];
    const p = e.active!;
    const dist = e.ghostY! - p.y;
    tap(e, 'hardDrop');
    expect(e.stats.score).toBe(2 * dist);
    expect(e.stats.pieces).toBe(1);
    expect(e.active!.type).toBe(next);
  });

  it('locks after the lock delay, and moves reset it (up to 15 times)', () => {
    const { e } = make();
    e.active = { type: 'T', rot: 0, x: 3, y: 20 };
    for (let t = 0; t < LOCK_MS - 50; t += STEP) e.tick(STEP);
    expect(e.stats.pieces).toBe(0);
    tap(e, 'left');
    for (let t = 0; t < LOCK_MS - 50; t += STEP) e.tick(STEP);
    expect(e.stats.pieces).toBe(0);
    for (let i = 0; i < 16; i++) tap(e, i % 2 ? 'left' : 'right');
    e.tick(STEP);
    expect(e.stats.pieces).toBe(1);
  });

  it('DAS then ARR slides the piece to the wall', () => {
    const { e } = make('marathon', 3, { das: 100, arr: 0, sdf: 20 });
    e.press('right');
    const after1 = e.active!.x;
    e.tick(50);
    expect(e.active!.x).toBe(after1);
    e.tick(60);
    const right = Math.max(...cellsOf(e.active!).map(([x]) => x));
    expect(right).toBe(W - 1);
  });

  it('holds once per piece', () => {
    const { e, events } = make();
    const first = e.active!.type;
    tap(e, 'hold');
    expect(e.hold).toBe(first);
    const second = e.active!.type;
    tap(e, 'hold');
    expect(e.active!.type).toBe(second);
    expect(events.filter((x) => x.type === 'hold')).toHaveLength(1);
  });

  it('clears a quad as a perfect clear', () => {
    const { e, events } = make();
    setBottom(e, ['XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.']);
    e.active = { type: 'I', rot: 1, x: 7, y: 2 };
    tap(e, 'hardDrop');
    const clear = events.find((x) => x.type === 'clear');
    expect(clear).toMatchObject({ lines: 4, perfect: true, label: 'QUAD' });
    expect(e.stats.quads).toBe(1);
    expect(e.stats.perfectClears).toBe(1);
    expect(e.board.every((r) => r.every((c) => !c))).toBe(true);
  });

  it('detects a T-spin double from a real rotation', () => {
    const { e, events } = make();
    setBottom(e, ['...X......', 'XXX...XXXX', 'XXXX.XXXXX']);
    e.active = { type: 'T', rot: 1, x: 3, y: 19 };
    tap(e, 'cw');
    expect(e.active).toMatchObject({ rot: 2, x: 3, y: 19 });
    tap(e, 'hardDrop');
    expect(events.find((x) => x.type === 'clear')).toMatchObject({ lines: 2, spin: 'full', label: 'T-SPIN DOUBLE', points: 1200 });
    expect(e.stats.tspinDoubles).toBe(1);
  });

  it('treats a T dropped into the slot (no rotation) as a plain clear', () => {
    const { e, events } = make();
    setBottom(e, ['XXX...XXXX', 'XXXX.XXXXX']);
    e.active = { type: 'T', rot: 2, x: 3, y: 5 };
    tap(e, 'hardDrop');
    expect(events.find((x) => x.type === 'clear')).toMatchObject({ lines: 2, spin: 'none' });
  });

  it('three-corner rule: mini vs full', () => {
    const b = emptyBoard();
    // Pointing right against the left wall: TL + BL (wall) + BR (block) filled, front TR open → mini.
    b[21][1] = 8;
    const p: Piece = { type: 'T', rot: 1, x: -1, y: 19 };
    expect(detectSpin(b, p, 0, false)).toBe('mini');
    expect(detectSpin(b, p, 4, false)).toBe('full');
    expect(detectSpin(b, { ...p, x: 4, y: 5 }, 0, false)).toBe('none');
  });

  it('tops out when a piece cannot spawn', () => {
    const { e, events } = make();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) e.board[y][x] = x === 0 ? 0 : 8;
    tap(e, 'hardDrop');
    expect(e.state).toBe('over');
    expect(events.at(-1)).toMatchObject({ type: 'end', result: { reason: 'topout' } });
  });

  it('zen never ends: topping out clears the well', () => {
    const { e, events } = make('zen');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) e.board[y][x] = x === 0 ? 0 : 8;
    tap(e, 'hardDrop');
    expect(e.state).toBe('playing');
    expect(events.some((x) => x.type === 'zenClear')).toBe(true);
  });

  it('ultra ends when time runs out', () => {
    const { e } = make('ultra');
    for (let t = 0; t < 121_000 && e.state === 'playing'; t += 500) {
      e.tick(500);
      if (e.active && e.state === 'playing') botMove(e);
    }
    expect(e.result).toMatchObject({ reason: 'time', completed: true, timeMs: 120_000 });
  });

  it('the bot finishes a 40-line sprint, and the same seed replays identically', () => {
    const run = (seed: number) => {
      const { e, events } = make('sprint', seed);
      for (let i = 0; i < 400 && e.state === 'playing'; i++) botMove(e);
      return { e, events };
    };
    const a = run(11);
    expect(a.e.result).toMatchObject({ reason: 'goal', completed: true });
    expect(a.e.stats.lines).toBeGreaterThanOrEqual(40);
    const b = run(11);
    expect(b.e.stats.score).toBe(a.e.stats.score);
    expect(b.e.stats.pieces).toBe(a.e.stats.pieces);
  });

  it('marathon levels up every 10 lines', () => {
    const { e, events } = make('marathon', 5);
    for (let i = 0; i < 200 && e.stats.lines < 20 && e.state === 'playing'; i++) botMove(e);
    expect(e.stats.level).toBe(1 + Math.floor(e.stats.lines / 10));
    expect(events.filter((x) => x.type === 'levelUp').length).toBeGreaterThanOrEqual(1);
  });
});
