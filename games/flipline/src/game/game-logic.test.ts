// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TAU } from '../lib/math';
import { BIKE, LANDING, STEP } from './config';
import { FlipTracker, judgeLanding } from './flips';
import { GEMS_PER_LEVEL, LEVELS, TOTAL_GEMS, buildLevel } from './levels';
import { Physics } from './physics';
import { GEM_RADIUS, carefulRider, placeGemsOnRideLine, simulate } from './sim';

const UP = { x: 0, y: 1 };

describe('flip judging', () => {
  const fly = (turns: number, landAngle = 0) => {
    const f = new FlipTracker();
    f.update(STEP, 0, true, UP);
    let a = 0;
    for (let i = 0; i < 60; i++) {
      a += (turns * TAU) / 60;
      f.update(1 / 60, a, false, UP);
    }
    return f.update(STEP, a + landAngle, true, UP);
  };

  it('counts backflips through ±π wraparound', () => {
    expect(fly(1)).toMatchObject({ flips: 1, quality: 'perfect' });
    expect(fly(2)).toMatchObject({ flips: 2 });
    expect(fly(0.9)?.flips).toBe(1); // forgiving a slightly early landing
    expect(fly(0.5)?.flips).toBe(0);
  });

  it('judges landing angle against the track normal', () => {
    expect(judgeLanding(0, UP).quality).toBe('perfect');
    expect(judgeLanding((30 * Math.PI) / 180, UP).quality).toBe('good');
    expect(judgeLanding((60 * Math.PI) / 180, UP).quality).toBe('rough');
    // On a 25° downslope, matching the slope is perfect.
    const slope = (-25 * Math.PI) / 180;
    expect(judgeLanding(slope, { x: -Math.sin(slope), y: Math.cos(slope) }).quality).toBe('perfect');
  });

  it('rewards flips with points and a capped speed boost', () => {
    const one = fly(1)!;
    expect(one.points).toBe(150); // flip + perfect
    expect(one.boost).toBe(LANDING.boostPerFlip + LANDING.perfectBoost);
    expect(fly(5)!.boost).toBeLessThanOrEqual(LANDING.boostMax + LANDING.perfectBoost);
    expect(fly(0.2)?.points ?? 0).toBe(0);
  });
});

describe('levels', () => {
  it('has 12 levels with 3 gems each', () => {
    expect(LEVELS).toHaveLength(12);
    expect(GEMS_PER_LEVEL.every((n) => n === 3)).toBe(true);
    expect(TOTAL_GEMS).toBe(36);
  });

  it.each(LEVELS.map((l) => [l.id, l.name, l] as const))('L%i %s builds valid geometry', (_id, _n, def) => {
    const b = buildLevel(def.pieces);
    expect(Number.isFinite(b.finishX)).toBe(true);
    for (const line of b.lines) {
      for (let i = 1; i < line.length; i++) {
        expect(line[i].x).toBeGreaterThan(line[i - 1].x);
        expect(Number.isFinite(line[i].y)).toBe(true);
      }
    }
    const xs = b.checkpoints.map((c) => c.x);
    expect(xs).toEqual([...xs].sort((a, c) => a - c));
    expect(xs.every((x) => x < b.finishX)).toBe(true);
    expect(b.gems.every((g) => g.x < b.finishX + 5)).toBe(true);
  });

  it.each(LEVELS.map((l) => [l.id, l.name, l] as const))('L%i %s is finishable by a careful rider', (_id, _n, def) => {
    const r = simulate(buildLevel(def.pieces), carefulRider, { seconds: 90 });
    expect(r.result).toBe('finish');
  });

  it.each(LEVELS.map((l) => [l.id, l.name, l] as const))('L%i %s is finishable from every checkpoint', (_id, _n, def) => {
    const b = buildLevel(def.pieces);
    for (let i = 1; i < b.checkpoints.length; i++) {
      expect(simulate(b, carefulRider, { seconds: 90, from: i }).result).toBe('finish');
    }
  });

  it.each(LEVELS.map((l) => [l.id, l.name, l] as const))('L%i %s: every gem is collectible on the riding line', (_id, _n, def) => {
    const b = placeGemsOnRideLine(buildLevel(def.pieces));
    const p = new Physics(b, b.checkpoints[0]);
    const best = b.gems.map(() => Infinity);
    for (let t = 0; t < 90; t += STEP) {
      p.step(STEP, carefulRider(p.state()));
      const s = p.state();
      b.gems.forEach((g, i) => (best[i] = Math.min(best[i], Math.hypot(g.x - s.x, g.y - s.y))));
      if (s.x > b.finishX) break;
    }
    for (const d of best) expect(d).toBeLessThan(GEM_RADIUS * 0.6);
  });

  it('a flip rider can land backflips on the jumps', () => {
    let landed = 0;
    for (const id of [4, 7]) {
      const b = buildLevel(LEVELS[id - 1].pieces);
      const f = new FlipTracker();
      let spun = 0, last: number | null = null;
      const r = simulate(b, (s) => {
        if (s.grounded) {
          spun = 0;
          last = null;
          return true;
        }
        if (last != null) spun += Math.atan2(Math.sin(s.angle - last), Math.cos(s.angle - last));
        last = s.angle;
        return spun < TAU - 0.9; // spin one full turn, then let it settle
      }, { seconds: 60 });
      landed += r.landings.filter((l) => l.flips >= 1).length;
      void f;
    }
    expect(landed).toBeGreaterThan(0);
  });
});

describe('physics', () => {
  const flat = buildLevel([{ t: 'flat', len: 200 }]);

  it('holding accelerates on the ground; releasing coasts', () => {
    const p = new Physics(flat, flat.checkpoints[0]);
    for (let i = 0; i < 120; i++) p.step(STEP, true);
    const fast = p.state().vx;
    expect(fast).toBeGreaterThan(8);
    for (let i = 0; i < 60; i++) p.step(STEP, false);
    expect(p.state().vx).toBeGreaterThan(fast * 0.6); // coasting, not braking
    expect(p.state().crashed).toBe(false);
  });

  it('holding in the air spins the bike backwards; releasing stops the spin', () => {
    const p = new Physics(flat, { x: 20, y: 30 });
    for (let i = 0; i < 20; i++) p.step(STEP, true);
    expect(p.chassis.getAngularVelocity()).toBeGreaterThan(BIKE.flipSpeed * 0.8);
    for (let i = 0; i < 40; i++) p.step(STEP, false);
    expect(Math.abs(p.chassis.getAngularVelocity())).toBeLessThan(1);
  });

  it('landing on your head crashes', () => {
    const p = new Physics(flat, { x: 20, y: 4 });
    p.chassis.setAngle(Math.PI);
    for (let i = 0; i < 120; i++) p.step(STEP, false);
    expect(p.state().crashed).toBe(true);
  });

  it('respawning at a checkpoint resets the bike and loops', () => {
    const b = buildLevel(LEVELS[2].pieces);
    const p = new Physics(b, b.checkpoints[0]);
    for (let i = 0; i < 300; i++) p.step(STEP, true);
    p.spawn(b.checkpoints[1]);
    const s = p.state();
    expect(s.x).toBeCloseTo(b.checkpoints[1].x, 0);
    expect(s.crashed).toBe(false);
    expect(p.loops.every((l) => l.progress === 0 && !l.done)).toBe(true);
  });
});
