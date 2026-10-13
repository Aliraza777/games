import { ROUND, countStep, initialCount, MIN_BREATH_GAP, type CountAction, type CountEvent, type CountState } from './counter';
import { cycleLength, type BreathPattern } from './patterns';
import { PlayerBreath, SyncTracker } from './sync';
import { levelAt, phaseAt, phaseLevels, sessionLength, type PhaseState } from './timeline';

export interface PacedStep {
  state: PhaseState;
  /** Guide lung level 0..1. */
  guide: number;
  /** Player's light 0..1, or null in "just follow" mode. */
  player: number | null;
  phaseChanged: boolean;
  /** Score of a breath that just finished (1 in follow mode). */
  cycleScore: number | null;
  done: boolean;
}

/** Drives a paced practice: timeline, the player's light and harmony scoring. */
export class PacedSession {
  readonly total: number;
  readonly cycles: number;
  t = 0;
  held = false;
  done = false;
  breaths = 0;
  readonly sync = new SyncTracker();
  private readonly player: PlayerBreath;
  private readonly levels: [number, number][];
  private lastKey = '';

  constructor(
    readonly pattern: BreathPattern,
    minutes: number,
    readonly follow: boolean,
  ) {
    this.total = sessionLength(pattern, minutes);
    this.cycles = Math.round(this.total / cycleLength(pattern));
    this.player = new PlayerBreath(pattern);
    this.levels = phaseLevels(pattern);
  }

  get harmony(): number | null {
    return this.follow ? null : this.sync.harmony;
  }

  get progress(): number {
    return this.t / this.total;
  }

  update(dt: number): PacedStep {
    if (!this.done) this.t = Math.min(this.t + dt, this.total);
    const end = this.t >= this.total;
    // Sample just inside the last breath at the very end so it reads as "exhale finished".
    const state = phaseAt(this.pattern, end ? this.total - 1e-6 : this.t);
    const guide = levelAt(this.pattern, end ? this.total - 1e-6 : this.t, this.levels);
    const player = this.follow ? null : this.player.update(this.held, dt);

    let cycleScore: number | null = null;
    if (!this.done) {
      if (this.follow) {
        if (state.cycle > this.breaths) cycleScore = 1;
      } else {
        cycleScore = this.sync.sample(state, this.held, dt);
      }
      this.breaths = Math.max(this.breaths, state.cycle);
      if (end) {
        this.done = true;
        this.breaths = this.cycles;
        cycleScore = this.follow ? 1 : this.sync.finish();
      }
    }

    const key = `${state.cycle}:${state.index}`;
    const phaseChanged = key !== this.lastKey;
    this.lastKey = key;
    return { state, guide, player, phaseChanged, cycleScore, done: this.done };
  }
}

/** How long to hold (session seconds) to "close the circle" on the ninth breath. */
export const HOLD_TO_CLOSE = 0.6;

export type CountResult = CountEvent | 'too-fast' | null;

/** Drives the breath-counting practice: tap vs press-and-hold, pacing guard, timer. */
export class CountSession {
  readonly total: number;
  t = 0;
  state: CountState = initialCount;
  taps = 0;
  private lastTap = -Infinity;
  private holdStart: number | null = null;
  private closedByHold = false;

  constructor(minutes: number) {
    this.total = Math.max(30, minutes * 60);
  }

  get done() {
    return this.t >= this.total;
  }

  /** 0..1 while a press is heading towards a close, else null. */
  get holdProgress(): number | null {
    if (this.holdStart == null || this.closedByHold) return null;
    return Math.min(1, (this.t - this.holdStart) / HOLD_TO_CLOSE);
  }

  /** Advance time; a long-enough press closes the circle *while* still held. */
  update(dt: number): CountResult {
    this.t = Math.min(this.t + dt, this.total);
    if (this.holdStart != null && !this.closedByHold && this.t - this.holdStart >= HOLD_TO_CLOSE) {
      this.closedByHold = true;
      return this.act('close');
    }
    return null;
  }

  press() {
    if (this.holdStart == null) {
      this.holdStart = this.t;
      this.closedByHold = false;
    }
  }

  release(): CountResult {
    if (this.holdStart == null) return null;
    this.holdStart = null;
    if (this.closedByHold) {
      this.closedByHold = false;
      return null;
    }
    return this.tap();
  }

  tap(): CountResult {
    if (this.t - this.lastTap < MIN_BREATH_GAP) return 'too-fast';
    return this.act('tap');
  }

  close(): CountResult {
    return this.act('close');
  }

  drift(): CountResult {
    return this.act('drift');
  }

  private act(a: CountAction): CountEvent {
    if (a !== 'drift') {
      this.lastTap = this.t;
      this.taps++;
    }
    const r = countStep(this.state, a);
    this.state = r.state;
    return r.event;
  }
}

export { ROUND };
