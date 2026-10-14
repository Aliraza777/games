import { TAU, angleDelta } from '../lib/math';
import { AIR_GRACE, LANDING, SCORE } from './config';

export type LandingQuality = 'perfect' | 'good' | 'rough';

export interface Landing {
  flips: number;
  quality: LandingQuality;
  /** Degrees between bike-up and the track normal at touchdown. */
  error: number;
  airTime: number;
  points: number;
  boost: number;
}

/** Judge how flat a landing was: angle between the bike's up vector and the ground normal. */
export function judgeLanding(bikeAngle: number, normal: { x: number; y: number }): { quality: LandingQuality; error: number } {
  const up = { x: -Math.sin(bikeAngle), y: Math.cos(bikeAngle) };
  const dot = Math.max(-1, Math.min(1, up.x * normal.x + up.y * normal.y));
  const error = (Math.acos(dot) * 180) / Math.PI;
  const quality: LandingQuality = error <= LANDING.perfect ? 'perfect' : error <= LANDING.good ? 'good' : 'rough';
  return { quality, error };
}

/**
 * Tracks rotation while airborne (unwrapped, so several flips add up) and
 * scores the landing. Backflips are counter-clockwise (positive) rotations.
 */
export class FlipTracker {
  private off = 0;
  private spun = 0;
  private air = 0;
  private last: number | null = null;
  airborne = false;

  /** Rotation so far this jump, in turns (HUD feedback). */
  get turns() {
    return this.spun / TAU;
  }

  update(dt: number, angle: number, grounded: boolean, normal: { x: number; y: number }): Landing | null {
    const d = this.last == null ? 0 : angleDelta(this.last, angle);
    this.last = angle;
    if (!grounded) {
      if (this.off === 0) this.spun = 0;
      this.off += dt;
      this.spun += d;
      if (this.off >= AIR_GRACE) this.airborne = true;
      if (this.airborne) this.air = this.off;
      return null;
    }
    this.off = 0;
    if (!this.airborne) return null;
    this.airborne = false;
    // Count completed turns, forgiving a slightly early landing.
    const flips = Math.floor(Math.abs(this.spun) / TAU + 0.15);
    const { quality, error } = judgeLanding(angle, normal);
    const perfect = quality === 'perfect';
    const points = flips * SCORE.flip + (perfect && flips > 0 ? SCORE.perfect : 0);
    const boost = Math.min(LANDING.boostMax, flips * LANDING.boostPerFlip) + (perfect && flips > 0 ? LANDING.perfectBoost : 0);
    return { flips, quality, error, airTime: this.air, points, boost };
  }

  reset() {
    this.off = 0;
    this.spun = 0;
    this.air = 0;
    this.last = null;
    this.airborne = false;
  }
}
