import { dist, distToSegment, polylineLength, type Vec } from '../lib/math';
import { INKS, MAX_SEGMENT, NO_DRAW_RADIUS, SAMPLE_SPACING, TANK, type InkKind } from './config';

/** The ink meter. Pure bookkeeping — no rendering, no physics. */
export class InkTank {
  level: number;
  constructor(
    readonly max = TANK.max,
    start = max,
  ) {
    this.level = start;
  }

  /** How many meters of this ink you can still afford. */
  metersLeft(kind: InkKind): number {
    return this.level / INKS[kind].cost;
  }

  /** Spend for `meters` of ink; returns the meters actually paid for. */
  spend(kind: InkKind, meters: number): number {
    const affordable = Math.min(meters, this.metersLeft(kind));
    this.level = Math.max(0, this.level - affordable * INKS[kind].cost);
    return affordable;
  }

  refill(amount: number) {
    this.level = Math.min(this.max, this.level + amount);
  }
}

export type AddResult = 'added' | 'too-close' | 'blocked' | 'empty';

/**
 * Turns pointer movement (in world space) into an evenly sampled stroke,
 * charging ink as it grows and refusing to draw through your own vehicle.
 */
export class StrokeBuilder {
  readonly points: Vec[] = [];
  length = 0;

  constructor(
    readonly kind: InkKind,
    private tank: InkTank,
    private unlimited = false,
  ) {}

  add(p: Vec, vehicle: Vec | null): AddResult {
    if (vehicle && dist(p, vehicle) < NO_DRAW_RADIUS) return 'blocked';
    const last = this.points[this.points.length - 1];
    if (!last) {
      if (!this.unlimited && this.tank.level <= 0) return 'empty';
      this.points.push({ ...p });
      return 'added';
    }
    const d = dist(last, p);
    if (d < SAMPLE_SPACING) return 'too-close';

    // Fast flicks: fill in so the physics chain has no long, rigid spans.
    const steps = Math.ceil(d / MAX_SEGMENT);
    let cur = last;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const next = { x: last.x + (p.x - last.x) * t, y: last.y + (p.y - last.y) * t };
      if (vehicle && dist(next, vehicle) < NO_DRAW_RADIUS) return 'blocked';
      const seg = dist(cur, next);
      const paid = this.unlimited ? seg : this.tank.spend(this.kind, seg);
      if (paid < seg) {
        if (paid > 0.05) {
          const k = paid / seg;
          this.points.push({ x: cur.x + (next.x - cur.x) * k, y: cur.y + (next.y - cur.y) * k });
          this.length += paid;
        }
        return 'empty';
      }
      this.points.push(next);
      this.length += seg;
      cur = next;
    }
    return 'added';
  }
}

export function strokeCost(points: readonly Vec[], kind: InkKind): number {
  return polylineLength(points) * INKS[kind].cost;
}

export function distToStroke(p: Vec, points: readonly Vec[]): number {
  if (points.length === 1) return dist(p, points[0]);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) best = Math.min(best, distToSegment(p, points[i - 1], points[i]));
  return best;
}

/**
 * Physics wants strokes to run left→right so boost ink always pushes you
 * forward, whichever way it was drawn.
 */
export function forwardOrder(points: readonly Vec[]): Vec[] {
  if (points.length < 2) return [...points];
  return points[points.length - 1].x < points[0].x ? [...points].reverse() : [...points];
}

/** Next/previous ink in the palette (mouse wheel). */
export function cycleInk(kind: InkKind, dir: 1 | -1, order: InkKind[]): InkKind {
  const i = order.indexOf(kind);
  return order[(i + dir + order.length) % order.length];
}
