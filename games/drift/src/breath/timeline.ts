import { clamp, easeInOutSine } from '../lib/math';
import { cycleLength, type BreathPattern, type Phase } from './patterns';

export interface PhaseState {
  index: number;
  phase: Phase;
  /** Seconds since this phase began. */
  elapsed: number;
  remaining: number;
  /** 0..1 through this phase. */
  progress: number;
  /** Completed cycles before this one. */
  cycle: number;
}

/** Lungs at the end of the first inhale when a top-up sip follows. */
export const TOPUP_BASE = 0.78;

/** Where the phase begins and ends on the 0 (empty) .. 1 (full) scale. */
export function phaseLevels(p: BreathPattern): [number, number][] {
  const out: [number, number][] = [];
  let level = 0;
  p.phases.forEach((ph, i) => {
    const from = level;
    switch (ph.kind) {
      case 'inhale':
        level = p.phases[i + 1]?.kind === 'topup' ? TOPUP_BASE : 1;
        break;
      case 'topup':
        level = 1;
        break;
      case 'exhale':
        level = 0;
        break;
      default:
        break; // hold / rest keep the level
    }
    out.push([from, level]);
  });
  return out;
}

export function phaseAt(p: BreathPattern, t: number): PhaseState {
  const L = cycleLength(p);
  const time = Math.max(0, t);
  const cycle = Math.floor(time / L);
  let tc = time - cycle * L;
  for (let i = 0; i < p.phases.length; i++) {
    const ph = p.phases[i];
    if (tc < ph.seconds || i === p.phases.length - 1) {
      const elapsed = Math.min(tc, ph.seconds);
      return {
        index: i,
        phase: ph,
        elapsed,
        remaining: ph.seconds - elapsed,
        progress: clamp(elapsed / ph.seconds, 0, 1),
        cycle,
      };
    }
    tc -= ph.seconds;
  }
  throw new Error('pattern has no phases');
}

/** How full the guide's lungs are at time t (0..1), eased like a real breath. */
export function levelAt(p: BreathPattern, t: number, levels = phaseLevels(p)): number {
  const s = phaseAt(p, t);
  const [from, to] = levels[s.index];
  return from + (to - from) * easeInOutSine(s.progress);
}

/** Sessions always finish on a whole breath — never cut someone off mid-exhale. */
export function sessionLength(p: BreathPattern, minutes: number): number {
  const L = cycleLength(p);
  return Math.max(1, Math.ceil((minutes * 60) / L - 1e-9)) * L;
}
