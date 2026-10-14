import { STEP } from './config';
import { FlipTracker, type Landing } from './flips';
import type { BuiltLevel } from './levels';
import { Physics } from './physics';

/** Headless run of a level with a scripted input policy (tests, solvability checks). */
export function simulate(
  level: BuiltLevel,
  policy: (s: ReturnType<Physics['state']>, t: number) => boolean,
  opts: { seconds?: number; from?: number } = {},
) {
  const start = level.checkpoints[opts.from ?? 0];
  const p = new Physics(level, start);
  const flips = new FlipTracker();
  const landings: Landing[] = [];
  let t = 0;
  let maxX = start.x;
  const limit = opts.seconds ?? 120;
  while (t < limit) {
    const s = p.state();
    p.step(STEP, policy(s, t));
    t += STEP;
    const after = p.state();
    maxX = Math.max(maxX, after.x);
    const l = flips.update(STEP, after.angle, after.grounded, after.normal);
    if (l) {
      landings.push(l);
      p.boost(l.boost);
    }
    if (after.crashed) return { result: 'crash' as const, x: after.x, t, landings, maxX };
    if (after.y < level.floor - 15) return { result: 'fall' as const, x: after.x, t, landings, maxX };
    if (after.x >= level.finishX) return { result: 'finish' as const, x: after.x, t, landings, maxX };
  }
  return { result: 'timeout' as const, x: p.state().x, t, landings, maxX };
}

/** A careful rider: full gas on the ground; in the air, only hold to lift a dipping nose. */
export const carefulRider = (s: ReturnType<Physics['state']>) => {
  if (s.grounded) return true;
  const a = Math.atan2(Math.sin(s.angle), Math.cos(s.angle));
  return a < -0.12;
};

/** Pickup radius for gems (m from the bike's centre). */
export const GEM_RADIUS = 1.8;

/**
 * Put every gem on the line a careful rider actually takes (same x, path height
 * + a little), so all of them are collectible. Deterministic, ~ms per level.
 */
export function placeGemsOnRideLine(level: BuiltLevel): BuiltLevel {
  const p = new Physics(level, level.checkpoints[0]);
  const path: { x: number; y: number }[] = [];
  for (let t = 0; t < 120; t += STEP) {
    p.step(STEP, carefulRider(p.state()));
    const s = p.state();
    path.push({ x: s.x, y: s.y });
    if (s.x > level.finishX || s.crashed) break;
  }
  const gems = level.gems.map((g) => {
    let best = path[0];
    for (const q of path) if (Math.abs(q.x - g.x) < Math.abs(best.x - g.x)) best = q;
    return { x: best.x, y: best.y + 0.3 };
  });
  return { ...level, gems };
}
