import { Graphics } from 'pixi.js';
import { audio } from '../../audio/AudioManager';
import { clamp, mean } from '../../lib/math';
import type { Target } from '../entities/Target';
import { TIMING, flowPoints, judge, type Judgement } from '../scoring/scoring';
import { BaseMode, type ModeSummary } from './BaseMode';
import { buildChart, type ChartNote } from './flowChart';

interface Note extends ChartNote {
  target: Target | null;
  done: boolean;
}

/**
 * Rhythm-aim hybrid. Song time comes from the AudioContext clock, so targets,
 * approach rings and judgement stay locked to what the player hears.
 */
export class FlowMode extends BaseMode {
  readonly id = 'flow' as const;
  allowHitstop = false;
  private bpm: number;
  private spb: number;
  private songLen: number;
  private approach: number;
  private notes: Note[] = [];
  private cursor = 0;
  private started = false;
  private deltas: number[] = [];
  private counts: Record<Judgement, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  private links = new Graphics();

  constructor(...args: ConstructorParameters<typeof BaseMode>) {
    super(...args);
    this.bpm = Math.round(clamp(118 * this.e.settings.gameSpeed, 84, 160));
    this.spb = 60 / this.bpm;
    this.songLen = this.duration + 4 * this.spb;
    this.approach = Math.max(0.65, this.spb * 2);
  }

  private get songTime() {
    return this.started ? audio.musicTime() : 0;
  }

  start() {
    const e = this.e;
    const r = e.baseRadius();
    this.notes = buildChart(e.rng, {
      spb: this.spb,
      songLen: this.songLen,
      field: e.playfield(r * 1.5),
      radius: r,
    }).map((n) => ({ ...n, target: null, done: false }));
    e.underlay.addChild(this.links);
    audio.startMusic({ bpm: this.bpm, style: 'flow', lengthSec: this.songLen + 1 });
    this.started = true;
  }

  pause() {
    audio.pauseMusic();
  }
  resume() {
    audio.resumeMusic();
  }
  destroy() {
    audio.stopMusic();
  }

  step() {
    const e = this.e;
    const st = this.songTime;
    // Spawn upcoming notes so their approach ring closes exactly on the beat.
    while (this.cursor < this.notes.length && this.notes[this.cursor].time - this.approach <= st) {
      const n = this.notes[this.cursor++];
      n.target = e.spawnTarget({ x: n.x, y: n.y, radius: e.baseRadius(), style: 'beat', approach: true });
    }
    for (const n of this.notes) {
      if (n.done || !n.target) continue;
      if (st > n.time + TIMING.good) {
        n.done = true;
        this.counts.miss++;
        e.penalize({ x: n.x, y: n.y, kind: 'expire' });
        n.target.kill('expire');
      }
    }
  }

  render() {
    const st = this.songTime;
    const g = this.links.clear();
    let prev: Note | null = null;
    for (let i = Math.max(0, this.cursor - 12); i < this.cursor; i++) {
      const n = this.notes[i];
      if (n.done || !n.target) continue;
      n.target.approachFrac = clamp(1 - (n.time - st) / this.approach, 0, 1);
      if (prev) {
        // Faint connector shows where the flow is heading next.
        g.moveTo(prev.x, prev.y).lineTo(n.x, n.y).stroke({ width: 2, color: this.e.hue, alpha: 0.18 });
      }
      prev = n;
    }
  }

  pointerDown(x: number, y: number) {
    const st = this.songTime;
    let best: Note | null = null;
    let bestHit: ReturnType<Target['hit']> = null;
    for (let i = Math.max(0, this.cursor - 12); i < this.cursor; i++) {
      const n = this.notes[i];
      if (n.done || !n.target) continue;
      const hit = n.target.hit(x, y);
      if (hit && (!best || Math.abs(n.time - st) < Math.abs(best.time - st))) {
        best = n;
        bestHit = hit;
      }
    }
    // Stray clicks are free here — Flow should feel like dancing, not walking on glass.
    if (!best || !bestHit || !best.target) return;
    const delta = st - best.time;
    if (delta < -TIMING.good) {
      this.e.fx.floater(best.x, best.y - best.target.radius - 6, 'early', { color: this.e.palette.muted, size: 14, rise: 12 });
      return;
    }
    const j = judge(delta);
    best.done = true;
    this.counts[j]++;
    this.deltas.push(delta * 1000);
    this.e.reward({
      x: best.x,
      y: best.y,
      radius: best.target.radius,
      points: flowPoints(j, bestHit.d),
      perfect: j === 'perfect',
      offset: bestHit,
      label: j.toUpperCase(),
    });
    best.target.kill('hit');
  }

  isOver() {
    return this.started && this.songTime >= this.songLen;
  }
  progress() {
    return clamp(this.songTime / this.songLen, 0, 1);
  }
  timeLeft() {
    return Math.max(0, this.songLen - this.songTime);
  }
  liveAccuracy() {
    const judged = this.e.hits + this.counts.miss;
    return judged ? this.e.hits / judged : null;
  }

  summary(): ModeSummary {
    const judged = this.e.hits + this.counts.miss;
    const acc = judged ? this.e.hits / judged : 0;
    const timing = this.deltas.length ? mean(this.deltas.map((d) => 1 - Math.abs(d) / (TIMING.good * 1000))) : 0;
    const bias = mean(this.deltas);
    return {
      accuracy: acc,
      avgReaction: null,
      rating: 0.6 * acc + 0.4 * timing,
      histogram: { label: 'Timing (early ← → late)', values: this.deltas, min: -180, max: 180, unit: 'ms', center: 0 },
      extra: [
        { label: 'Perfect / Great / Good', value: `${this.counts.perfect} / ${this.counts.great} / ${this.counts.good}` },
        {
          label: 'Timing bias',
          value: this.deltas.length ? `${Math.abs(Math.round(bias))} ms ${bias >= 0 ? 'late' : 'early'}` : '—',
        },
      ],
    };
  }
}
