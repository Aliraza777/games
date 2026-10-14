// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { VEHICLES, VEHICLE_ORDER, type InkKind, type VehicleId } from './config';
import { Physics, type Controls } from './physics';
import type { Platform } from './worldgen';

const DT = 1 / 60;
const flat = (id: number, x0: number, x1: number, y = 0): Platform => {
  const n = Math.round((x1 - x0) / 2.5);
  return { id, x0, x1, points: Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y })) };
};
const line = (x0: number, y0: number, x1: number, y1: number, n = 12) =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n }));

function sim(id: VehicleId, setup: (p: Physics) => void, seconds: number, controls: Partial<Controls> = {}) {
  const spec = VEHICLES[id];
  const p = new Physics(spec, { x: 2, y: -spec.wheel.y + spec.wheel.r + 0.1 });
  setup(p);
  const c: Controls = { throttle: 1, lean: 0, hop: false, ...controls };
  let maxY = -Infinity, maxVx = 0;
  for (let t = 0; t < seconds; t += DT) {
    p.step(DT, c);
    const s = p.state();
    maxY = Math.max(maxY, s.y);
    maxVx = Math.max(maxVx, s.vx);
  }
  return { state: p.state(), maxY, maxVx, physics: p };
}

describe.each(VEHICLE_ORDER)('%s', (id) => {
  it('drives forward on flat ground and stays upright', () => {
    const { state } = sim(id, (p) => p.addPlatform(flat(1, -10, 200)), 4);
    expect(state.x).toBeGreaterThan(20);
    expect(Math.abs(state.angle)).toBeLessThan(0.5);
    expect(state.grounded).toBe(true);
    expect(state.crashed).toBe(false);
  });

  it('falls into an open gap', () => {
    const { state } = sim(
      id,
      (p) => {
        p.addPlatform(flat(1, -10, 14));
        p.addPlatform(flat(2, 26, 80));
      },
      5,
    );
    expect(state.y).toBeLessThan(-5);
  });

  it('crosses the same gap on a drawn bridge', () => {
    const { state } = sim(
      id,
      (p) => {
        p.addPlatform(flat(1, -10, 14));
        p.addPlatform(flat(2, 26, 120));
        p.setStroke(1, line(13, 0.05, 27, 0.05), 'road');
      },
      5,
    );
    expect(state.x).toBeGreaterThan(30);
    expect(state.y).toBeGreaterThan(-1);
  });

  it('climbs a drawn ramp up a cliff', () => {
    const { state } = sim(
      id,
      (p) => {
        p.addPlatform(flat(1, -10, 14));
        p.addPlatform(flat(2, 18, 120, 3.5));
        p.setStroke(1, line(4, 0.05, 18.5, 3.55, 20), 'road');
      },
      7,
    );
    expect(state.x).toBeGreaterThan(22);
    expect(state.y).toBeGreaterThan(3);
  });
});

describe('ink types', () => {
  const ground = (p: Physics) => p.addPlatform(flat(1, -10, 300));

  it('landing on bounce ink rebounds you; road ink absorbs the landing', () => {
    const rebound = (kind: InkKind) => {
      const p = new Physics(VEHICLES.car, { x: 10, y: 7 });
      p.setStroke(1, line(0, 0, 20, 0), kind);
      let landed = false, peak = -Infinity;
      for (let i = 0; i < 180; i++) {
        p.step(DT, { throttle: 0, lean: 0, hop: false });
        const s = p.state();
        if (!landed && s.vy > 0.5) landed = true; // started going back up
        if (landed) peak = Math.max(peak, s.y);
      }
      return peak;
    };
    const bounce = rebound('bounce');
    expect(bounce).toBeGreaterThan(4.5); // most of the 7 m drop comes back
    expect(bounce).toBeGreaterThan(rebound('road') + 2.5);
  });

  it('bounce ink fires the bounce callback', () => {
    let bounces = 0;
    const spec = VEHICLES.car;
    const p = new Physics(spec, { x: 10, y: 6 });
    p.onBounce = () => bounces++;
    p.addPlatform(flat(1, -10, 50, -5));
    p.setStroke(1, line(0, 0, 20, 0), 'bounce');
    for (let i = 0; i < 120; i++) p.step(DT, { throttle: 0, lean: 0, hop: false });
    expect(bounces).toBeGreaterThan(0);
  });

  it('boost ink makes you faster than road ink — in either draw direction', () => {
    const speed = (kind: InkKind, reverse = false) =>
      sim('car', (p) => {
        ground(p);
        const pts = line(4, 0.05, 60, 0.05, 30);
        p.setStroke(1, reverse ? pts.reverse() : pts, kind);
      }, 2.5, { throttle: 0.5 }).maxVx;
    const road = speed('road');
    expect(speed('boost')).toBeGreaterThan(road * 1.3);
    expect(speed('boost', true)).toBeGreaterThan(road * 1.3);
  });
});

describe('one-way ink', () => {
  it('a stroke drawn just above the roof does not trap you — you drive under it', () => {
    const { state } = sim('car', (p) => {
      p.addPlatform(flat(1, -10, 200));
      // From above the cabin, rising ahead — exactly the live soft-lock.
      p.setStroke(1, line(2.5, 1.9, 20, 4.5, 20), 'road');
    }, 4);
    expect(state.x).toBeGreaterThan(25);
    expect(state.crashed).toBe(false);
  });

  it('you can still land on top of ink from above', () => {
    const p = new Physics(VEHICLES.car, { x: 10, y: 6 });
    p.setStroke(1, line(0, 0, 20, 0), 'road');
    for (let i = 0; i < 180; i++) p.step(DT, { throttle: 0, lean: 0, hop: false });
    expect(p.state().y).toBeGreaterThan(0.5);
    expect(p.state().grounded).toBe(true);
  });

  it('jumping up through a stroke lands you on it', () => {
    const p = new Physics(VEHICLES.car, { x: 10, y: -4 });
    p.setStroke(1, line(0, 0, 20, 0), 'road');
    p.chassis.setLinearVelocity({ x: 0, y: 14 } as never);
    p.wheels.forEach((w) => w.setLinearVelocity({ x: 0, y: 14 } as never));
    for (let i = 0; i < 240; i++) p.step(DT, { throttle: 0, lean: 0, hop: false });
    expect(p.state().y).toBeGreaterThan(0.5);
    // QA I2: brushing the line on the way up is not a crash.
    expect(p.state().crashed).toBe(false);
  });

  it.each(['car', 'bike', 'truck'] as const)('%s survives jumping up through ink', (id) => {
    const p = new Physics(VEHICLES[id], { x: 10, y: -4 });
    p.setStroke(1, line(0, 0, 20, 0), 'road');
    p.chassis.setLinearVelocity({ x: 0, y: 14 } as never);
    p.wheels.forEach((w) => w.setLinearVelocity({ x: 0, y: 14 } as never));
    for (let i = 0; i < 240; i++) p.step(DT, { throttle: 0, lean: 0, hop: false });
    expect(p.state().crashed).toBe(false);
  });
});

describe('crashes & control', () => {
  it('landing on the roof crashes', () => {
    const spec = VEHICLES.car;
    const p = new Physics(spec, { x: 0, y: 3 });
    p.addPlatform(flat(1, -20, 20));
    p.chassis.setAngle(Math.PI);
    for (let i = 0; i < 120; i++) p.step(DT, { throttle: 0, lean: 0, hop: false });
    expect(p.state().crashed).toBe(true);
  });

  it('leaning rotates the vehicle in the air', () => {
    const spec = VEHICLES.bike;
    const p = new Physics(spec, { x: 0, y: 20 });
    for (let i = 0; i < 60; i++) p.step(DT, { throttle: 0, lean: 1, hop: false });
    expect(p.state().angle).toBeGreaterThan(1);
  });

  it('hop only works on the ground', () => {
    const spec = VEHICLES.car;
    const p = new Physics(spec, { x: 0, y: 1.2 });
    p.addPlatform(flat(1, -20, 20));
    for (let i = 0; i < 60; i++) p.step(DT, { throttle: 0, lean: 0, hop: false });
    const y0 = p.state().y;
    let maxY = y0;
    for (let i = 0; i < 40; i++) {
      p.step(DT, { throttle: 0, lean: 0, hop: i === 0 });
      maxY = Math.max(maxY, p.state().y);
    }
    expect(maxY - y0).toBeGreaterThan(0.4);
  });

  it('strokes can be replaced and removed', () => {
    const p = new Physics(VEHICLES.car, { x: 5, y: 3 });
    p.setStroke(7, line(0, 0, 10, 0), 'road');
    p.setStroke(7, line(0, 0, 12, 0), 'road');
    for (let i = 0; i < 60; i++) p.step(DT, { throttle: 0, lean: 0, hop: false });
    expect(p.state().y).toBeGreaterThan(0);
    p.removeStroke(7);
    for (let i = 0; i < 60; i++) p.step(DT, { throttle: 0, lean: 0, hop: false });
    expect(p.state().y).toBeLessThan(0);
  });
});
