export type PhaseKind = 'inhale' | 'topup' | 'hold' | 'exhale' | 'rest';

export interface Phase {
  kind: PhaseKind;
  seconds: number;
  /** What the player sees and hears as the instruction. */
  cue: string;
}

export interface BreathPattern {
  phases: Phase[];
}

export type PacedId = 'sigh' | 'resonance' | 'box';

/**
 * Breathing patterns. Timings follow the protocols in the research notes
 * (see practices.ts for the sources).
 */
export const PATTERNS: Record<PacedId, BreathPattern> = {
  // Cyclic sighing: two inhales through the nose, then a long, slow exhale.
  sigh: {
    phases: [
      { kind: 'inhale', seconds: 2, cue: 'Breathe in' },
      { kind: 'topup', seconds: 1, cue: 'Sip in a little more' },
      { kind: 'exhale', seconds: 6, cue: 'Slowly let it all go' },
    ],
  },
  // Resonance / coherent breathing at ~5.5 breaths per minute, equal in and out.
  resonance: {
    phases: [
      { kind: 'inhale', seconds: 5.5, cue: 'Breathe in' },
      { kind: 'exhale', seconds: 5.5, cue: 'Breathe out' },
    ],
  },
  // Box breathing: four equal sides.
  box: {
    phases: [
      { kind: 'inhale', seconds: 4, cue: 'Breathe in' },
      { kind: 'hold', seconds: 4, cue: 'Hold, softly' },
      { kind: 'exhale', seconds: 4, cue: 'Breathe out' },
      { kind: 'rest', seconds: 4, cue: 'Rest, empty' },
    ],
  },
};

export function cycleLength(p: BreathPattern): number {
  return p.phases.reduce((s, ph) => s + ph.seconds, 0);
}

export function breathsPerMinute(p: BreathPattern): number {
  return 60 / cycleLength(p);
}

/** In "hold to breathe" mode, the player holds while lungs fill or stay full. */
export function expectsHold(kind: PhaseKind): boolean {
  return kind === 'inhale' || kind === 'topup' || kind === 'hold';
}

/** Total seconds spent breathing in (inhale + top-up) and out, per cycle. */
export function inOutSeconds(p: BreathPattern): { inhale: number; exhale: number } {
  let inhale = 0, exhale = 0;
  for (const ph of p.phases) {
    if (ph.kind === 'inhale' || ph.kind === 'topup') inhale += ph.seconds;
    if (ph.kind === 'exhale') exhale += ph.seconds;
  }
  return { inhale, exhale };
}
