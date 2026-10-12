import { audio } from '../../audio/AudioManager';
import { catmullRom, clamp, dist, type Vec } from '../../lib/math';
import type { Target } from '../entities/Target';
import { Trail } from '../entities/Trail';
import { BaseMode, type ModeSummary } from './BaseMode';

const TICK = 0.25;
const GRACE = 0.15;

/** The orb glides along a Catmull-Rom spline; you hold the crosshair on it. */
export class TrackMode extends BaseMode {
  readonly id = 'track' as const;
  allowHitstop = false;
  private orb!: Target;
  private pts: Vec[] = [];
  private u = 0;
  private segLen = 1;
  private onTime = 0;
  private streak = 0;
  private longest = 0;
  private offFor = 0;
  private tickAcc = 0;
  private sampleAcc = 0;
  private samples: Vec[] = [];
  private on = false;
  private orbTrail!: Trail;
  private cursorTrail!: Trail;

  start() {
    const e = this.e;
    const r = e.baseRadius() * 1.15;
    const c = { x: e.width / 2, y: e.height / 2 };
    this.pts = [c, c];
    this.pts.push(this.nextPoint(c), this.nextPoint(c));
    this.pts[0] = this.nextPoint(c);
    this.segLen = this.measure();
    this.orb = e.spawnTarget({ x: c.x, y: c.y, radius: r, style: 'orb' });

    this.orbTrail = new Trail({ length: 40, width: r * 0.9, color: e.hue, alpha: 0.35 });
    this.orbTrail.view.blendMode = 'add';
    this.cursorTrail = new Trail({ length: 24, width: 3, color: e.palette.muted, alpha: 0.5 });
    e.underlay.addChild(this.orbTrail.view, this.cursorTrail.view);
  }

  private nextPoint(from: Vec): Vec {
    const r = this.e.baseRadius() * 2;
    const pf = this.e.playfield(r);
    return this.randomPoint(r, from, Math.min(pf.w, pf.h) * 0.3);
  }

  /** Approximate arc length of the current segment so speed stays even. */
  private measure(): number {
    const [p0, p1, p2, p3] = this.pts;
    let len = 0;
    let prev = p1;
    for (let i = 1; i <= 12; i++) {
      const q = catmullRom(p0, p1, p2, p3, i / 12);
      len += dist(prev.x, prev.y, q.x, q.y);
      prev = q;
    }
    return Math.max(len, 1);
  }

  step(dt: number) {
    const e = this.e;
    const minDim = Math.min(e.width, e.height);
    const speed = minDim * 0.42 * e.settings.gameSpeed * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(e.time * 0.7)));
    this.u += (speed * dt) / this.segLen;
    while (this.u >= 1) {
      this.u -= 1;
      this.pts.shift();
      this.pts.push(this.nextPoint(this.pts[this.pts.length - 1]));
      this.segLen = this.measure();
    }
    const [p0, p1, p2, p3] = this.pts;
    const p = catmullRom(p0, p1, p2, p3, this.u);
    this.orb.x = p.x;
    this.orb.y = p.y;

    const dx = e.cursor.x - p.x, dy = e.cursor.y - p.y;
    const d = Math.hypot(dx, dy);
    const on = d <= this.orb.radius;
    if (on !== this.on) {
      this.on = on;
      this.orb.glowTarget = on ? 1 : 0;
      audio.setTrackTone(on);
    }

    if (on) {
      this.onTime += dt;
      this.streak += dt;
      this.longest = Math.max(this.longest, this.streak);
      this.offFor = 0;
      this.tickAcc += dt;
      while (this.tickAcc >= TICK) {
        this.tickAcc -= TICK;
        e.reward({ x: p.x, y: p.y, points: 25, quiet: true, radius: this.orb.radius });
      }
    } else {
      this.offFor += dt;
      if (this.offFor > GRACE && this.streak > 0) {
        this.streak = 0;
        this.tickAcc = 0;
        e.penalize({ x: e.cursor.x, y: e.cursor.y, kind: 'miss', countMiss: false, quiet: true });
      }
    }

    this.sampleAcc += dt;
    if (this.sampleAcc >= 0.1) {
      this.sampleAcc = 0;
      const r = this.orb.radius;
      if (d < r * 2.5) this.samples.push({ x: clamp(dx / r, -2.5, 2.5), y: clamp(dy / r, -2.5, 2.5) });
    }
  }

  render() {
    this.orbTrail.push(this.orb.x, this.orb.y);
    this.orbTrail.redraw();
    this.cursorTrail.push(this.e.cursor.x, this.e.cursor.y);
    this.cursorTrail.redraw();
  }

  pause() {
    audio.setTrackTone(false);
    this.on = false;
  }

  destroy() {
    audio.stopTrackTone();
  }

  liveAccuracy() {
    return this.e.time > 0.5 ? this.onTime / this.e.time : null;
  }

  summary(): ModeSummary {
    const acc = this.e.time > 0 ? this.onTime / this.e.time : 0;
    return {
      accuracy: acc,
      avgReaction: null,
      rating: clamp((acc - 0.2) / 0.7, 0, 1),
      offsets: this.samples,
      offsetsLabel: 'Tracking error (crosshair vs orb)',
      histogram: null,
      extra: [
        { label: 'Time on target', value: `${this.onTime.toFixed(1)} s` },
        { label: 'Longest streak', value: `${this.longest.toFixed(1)} s` },
      ],
    };
  }
}
