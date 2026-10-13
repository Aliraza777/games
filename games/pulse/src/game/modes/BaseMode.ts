import type { Engine } from '../engine/Engine';
import type { Histogram, ModeId, StatLine, Vec } from '../types';
import { clamp, dist } from '../../lib/math';

export interface ModeSummary {
  /** 0..1, drives the grade. */
  rating: number;
  accuracy: number;
  avgReaction?: number | null;
  offsets?: Vec[];
  offsetsLabel?: string;
  histogram: Histogram | null;
  extra: StatLine[];
}

export interface Mode {
  readonly id: ModeId;
  readonly allowHitstop: boolean;
  readonly showScore: boolean;
  start(): void;
  pause(): void;
  resume(): void;
  /** Fixed-timestep game logic. */
  step(dt: number): void;
  /** Per-frame visuals. */
  render(dt: number): void;
  pointerDown(x: number, y: number, timeStamp: number): void;
  isOver(): boolean;
  progress(): number;
  timeLeft(): number | null;
  liveAccuracy(): number | null;
  hudLabel(): string | null;
  summary(): ModeSummary;
  destroy(): void;
}

export abstract class BaseMode implements Mode {
  abstract readonly id: ModeId;
  allowHitstop = true;
  showScore = true;
  protected readonly duration: number;

  constructor(protected readonly e: Engine) {
    this.duration = e.settings.runLength;
  }

  start() {}
  pause() {}
  resume() {}
  step(_dt: number) {}
  render(_dt: number) {}
  pointerDown(_x: number, _y: number, _ts: number) {}
  destroy() {}

  isOver() {
    return this.e.time >= this.duration;
  }
  progress() {
    return clamp(this.e.time / this.duration, 0, 1);
  }
  timeLeft(): number | null {
    return Math.max(0, this.duration - this.e.time);
  }
  liveAccuracy(): number | null {
    return this.e.hits + this.e.misses > 0 ? this.e.accuracy() : null;
  }
  hudLabel(): string | null {
    return null;
  }

  abstract summary(): ModeSummary;

  /** Random point in the playfield, at least `minGap` away from `avoid`. */
  protected randomPoint(margin: number, avoid?: Vec, minGap = 0): Vec {
    const pf = this.e.playfield(margin);
    let p: Vec = { x: 0, y: 0 };
    for (let i = 0; i < 24; i++) {
      p = { x: pf.x + this.e.rng() * pf.w, y: pf.y + this.e.rng() * pf.h };
      if (!avoid || dist(p.x, p.y, avoid.x, avoid.y) >= minGap) break;
    }
    return p;
  }
}
