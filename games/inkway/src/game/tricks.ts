import { TAU, angleDelta } from '../lib/math';
import { SCORE, TANK } from './config';

export interface TrickLanding {
  flips: number;
  /** Back = rotating counter-clockwise (nose up) while moving right. */
  direction: 'back' | 'front' | null;
  airTime: number;
  bigAir: boolean;
  combo: number;
  points: number;
  ink: number;
  label: string;
}

/** Leaving the ground for less than this doesn't count as airborne (bumps). */
export const AIR_GRACE = 0.18;
/** A rotation counts as a flip a little before a full 360° — landings are messy. */
export const FLIP_TOLERANCE = 0.2;
const COMBO_WINDOW = 8;

/**
 * Accumulates rotation while airborne and scores it on landing. Angles are
 * unwrapped frame-to-frame so multiple rotations add up correctly.
 */
export class TrickTracker {
  combo = 0;
  private airborne = false;
  private offGround = 0;
  private airTime = 0;
  private spun = 0;
  private lastAngle: number | null = null;
  private sinceTrick = Infinity;

  get isAirborne() {
    return this.airborne;
  }

  /** Current rotation in the air, in turns (for HUD feedback). */
  get turns() {
    return this.spun / TAU;
  }

  update(dt: number, angle: number, grounded: boolean): TrickLanding | null {
    const delta = this.lastAngle == null ? 0 : angleDelta(this.lastAngle, angle);
    this.lastAngle = angle;
    this.sinceTrick += dt;
    if (this.sinceTrick > COMBO_WINDOW) this.combo = 0;

    if (!grounded) {
      // Count rotation from the moment the wheels leave — not only after the grace period.
      if (this.offGround === 0) this.spun = 0;
      this.offGround += dt;
      this.spun += delta;
      if (!this.airborne && this.offGround >= AIR_GRACE) this.airborne = true;
      if (this.airborne) this.airTime = this.offGround;
      return null;
    }

    this.offGround = 0;
    if (!this.airborne) return null;
    this.airborne = false;

    const flips = Math.floor(Math.abs(this.spun) / TAU + FLIP_TOLERANCE);
    const bigAir = this.airTime >= SCORE.bigAirTime;
    if (flips === 0 && !bigAir) return null;

    this.combo = Math.min(this.combo + 1, 5);
    this.sinceTrick = 0;
    const direction = flips === 0 ? null : this.spun > 0 ? 'back' : 'front';
    const base = flips * SCORE.flip + (bigAir ? SCORE.bigAir : 0);
    const name = direction === 'back' ? 'Backflip' : direction === 'front' ? 'Frontflip' : 'Big air';
    return {
      flips,
      direction,
      airTime: this.airTime,
      bigAir,
      combo: this.combo,
      points: base * this.combo,
      ink: flips * TANK.flipRefill,
      label: flips > 1 ? `${name} ×${flips}` : name,
    };
  }

  /** A crash cancels whatever was in progress. */
  reset() {
    this.airborne = false;
    this.offGround = 0;
    this.spun = 0;
    this.combo = 0;
  }
}
