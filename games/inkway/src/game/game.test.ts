import { afterEach, describe, expect, it } from 'vitest';
import { VEHICLE_ORDER, type VehicleId } from './config';
import { Game, type GameEvent, type GameOptions, type RunResult } from './Game';

/** Drive the game loop manually (no rAF) — deterministic and fast. */
const tick = (g: Game, seconds: number, dt = 1 / 60) => {
  const frame = (g as unknown as { frame(dt: number): void }).frame.bind(g);
  for (let t = 0; t < seconds; t += dt) frame(dt);
};
const CODES: Record<string, string> = { w: 'KeyW', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3' };
const press = (key: string, type: 'keydown' | 'keyup' = 'keydown') => window.dispatchEvent(new KeyboardEvent(type, { key, code: CODES[key] ?? key }));

const games: Game[] = [];
function make(opts: Partial<GameOptions> & { vehicle?: VehicleId } = {}) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const events: GameEvent[] = [];
  let over: RunResult | null = null;
  const g = new Game(canvas, {
    vehicle: 'car',
    seed: 1234,
    onEvent: (e) => events.push(e),
    onOver: (r) => (over = r),
    ...opts,
  });
  games.push(g);
  return { g, events, over: () => over };
}

afterEach(() => {
  games.splice(0).forEach((g) => g.destroy());
  press('w', 'keyup');
});

describe('Game (integration)', () => {
  it.each(VEHICLE_ORDER)('autopilot (%s) clears generated gaps and cliffs', (vehicle) => {
    for (const seed of [1, 77]) {
      const { g } = make({ vehicle, seed, attract: true });
      tick(g, 40);
      expect(g.distance).toBeGreaterThan(280);
      expect(g.state).toBe('running');
    }
  });

  it('waits for throttle, then starts and hints', () => {
    const { g, events } = make({ tutorial: true });
    expect(events[0]).toMatchObject({ type: 'hint', id: 'drive' });
    tick(g, 1);
    expect(g.state).toBe('ready');
    expect(g.distance).toBe(0);
    press('w');
    tick(g, 1);
    expect(g.state).toBe('running');
    expect(events.some((e) => e.type === 'hint-done' && e.id === 'drive')).toBe(true);
    expect(g.distance).toBeGreaterThan(1);
  });

  it('teaches the first gap: hint + slow motion, then a drawn bridge gets you across', () => {
    const { g, events } = make({ tutorial: true });
    const gap = g.nextGap()!;
    press('w');
    // Drive until the tutorial kicks in.
    for (let i = 0; i < 600 && !events.some((e) => e.type === 'hint' && e.id === 'draw'); i++) tick(g, 1 / 60);
    expect(events.some((e) => e.type === 'hint' && e.id === 'draw')).toBe(true);
    expect(g.ghostGap?.id).toBe(gap.id);

    const pts = Array.from({ length: 20 }, (_, i) => ({ x: gap.from.x - 1 + ((gap.to.x - gap.from.x + 2) * i) / 19, y: gap.from.y + 0.05 }));
    const before = g.tank.level;
    expect(g.drawStroke(pts, 'road')).toBeGreaterThan(0);
    expect(g.tank.level).toBeLessThan(before);
    tick(g, 6);
    expect(g.vehicle().x).toBeGreaterThan(gap.to.x + 2);
    expect(g.state).toBe('running');
    expect(events.some((e) => e.type === 'hint-done' && e.id === 'draw')).toBe(true);
  });

  it('driving into a gap without a bridge ends the run in the void', () => {
    const { g, over } = make();
    press('w');
    tick(g, 20);
    expect(over()).not.toBeNull();
    expect(over()!).toMatchObject({ cause: 'void', vehicle: 'car', seed: 1234 });
    expect(over()!.distance).toBeGreaterThan(30);
    expect(g.state).toBe('over');
  });

  it('switches ink with number keys — even while Shift is held (QA I3)', () => {
    const { g } = make();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '@', code: 'Digit2', shiftKey: true }));
    expect(g.inkKind).toBe('bounce');
  });

  it('drives with physical WASD on any layout (AZERTY Z = KeyW) (QA I3)', () => {
    const { g } = make();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyW' }));
    tick(g, 1);
    expect(g.state).toBe('running');
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z', code: 'KeyW' }));
  });

  it('touch: the virtual stick drives and drawing slows time automatically', () => {
    const { g } = make({ touch: true });
    g.setVirtual({ throttle: 1 });
    tick(g, 1);
    expect(g.state).toBe('running');
    expect(g.distance).toBeGreaterThan(1);
    (g as unknown as { mouse: { drawing: boolean } }).mouse.drawing = true;
    expect(g.focusActive).toBe(true);
  });

  it('switches ink with number keys', () => {
    const { g } = make();
    press('2');
    expect(g.inkKind).toBe('bounce');
    press('3');
    expect(g.inkKind).toBe('boost');
    press('1');
    expect(g.inkKind).toBe('road');
  });

  it('pause freezes the world; resume continues', () => {
    const { g } = make();
    press('w');
    tick(g, 1);
    g.pause();
    const x = g.vehicle().x;
    tick(g, 2);
    expect(g.vehicle().x).toBe(x);
    g.resume();
    tick(g, 0.5);
    expect(g.vehicle().x).toBeGreaterThan(x);
  });

  it('right-click erase refunds half the ink', () => {
    const { g } = make();
    const id = g.drawStroke(
      Array.from({ length: 11 }, (_, i) => ({ x: 20 + i, y: 3 })),
      'road',
    );
    expect(id).toBeGreaterThan(0);
    const after = g.tank.level;
    expect(g.erase({ x: 25, y: 3.2 })).toBe(true);
    expect(g.tank.level).toBeCloseTo(after + 5, 0);
    expect(g.strokes.size).toBe(0);
    expect(g.erase({ x: 25, y: 3.2 })).toBe(false);
  });

  it('screen ↔ world conversion round-trips', () => {
    const { g } = make();
    const p = { x: 31.5, y: -2.25 };
    const back = g.screenToWorld(g.worldToScreen(p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });
});
