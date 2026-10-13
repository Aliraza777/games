import { PATTERNS, breathsPerMinute, type PacedId } from './patterns';

export type PracticeId = PacedId | 'count' | 'pond';
export type PracticeKind = 'paced' | 'count' | 'pond';

export interface Source {
  label: string;
  url: string;
}

export interface Practice {
  id: PracticeId;
  kind: PracticeKind;
  name: string;
  /** One line on the card. */
  tagline: string;
  /** What it's for, as a chip. */
  goal: 'Calm' | 'Focus' | 'Unwind';
  /** Plain-language "why this works", shown on demand. */
  why: string;
  sources: Source[];
  durations: number[];
  defaultMinutes: number;
  /** Paced practices only: short how-to for the setup sheet. */
  howTo: string;
}

const bpm = (id: PacedId) => Math.round(breathsPerMinute(PATTERNS[id]) * 10) / 10;

export const PRACTICES: Practice[] = [
  {
    id: 'sigh',
    kind: 'paced',
    name: 'Sigh',
    tagline: 'Two breaths in, one long breath out.',
    goal: 'Calm',
    why:
      'Cyclic sighing puts the weight on a long, slow exhale. In a month-long randomized study, five minutes a day of it improved mood and slowed resting breathing more than an equal time of mindfulness meditation.',
    sources: [
      {
        label: 'Balban et al., Cell Reports Medicine (2023)',
        url: 'https://hubermanlab.stanford.edu/publications/brief-structured-respiration-practices-enhance-mood-and-reduce-physiological-arousal',
      },
    ],
    durations: [1, 3, 5],
    defaultMinutes: 5,
    howTo: 'Hold as you breathe in, keep holding for the extra sip, then let go and exhale slowly.',
  },
  {
    id: 'resonance',
    kind: 'paced',
    name: 'Tide',
    tagline: `Slow, even waves at ${bpm('resonance')} breaths a minute.`,
    goal: 'Calm',
    why:
      'Breathing at around 5.5–6 breaths a minute ("resonance" breathing) lines your heart rhythm up with your breath and raises heart-rate variability, which is linked with lower stress and anxiety.',
    sources: [
      { label: '5.5 breaths/min with equal in & out gave the highest HRV (2014)', url: 'https://pubmed.ncbi.nlm.nih.gov/24380741/' },
      {
        label: 'Resonance breathing & HRV review',
        url: 'https://qigonginstitute.org/abstract-print/17327',
      },
    ],
    durations: [3, 5, 10],
    defaultMinutes: 5,
    howTo: 'Hold while the light grows, let go while it shrinks. Close your eyes and follow the waves if you like.',
  },
  {
    id: 'box',
    kind: 'paced',
    name: 'Box',
    tagline: 'Four even sides: in, hold, out, rest.',
    goal: 'Focus',
    why:
      'Box breathing gives the mind a simple, structured task — counting four equal sides — which steadies attention while slowing the breath. It was one of the practices that improved mood in the same 2023 breathwork study.',
    sources: [
      {
        label: 'Balban et al., Cell Reports Medicine (2023)',
        url: 'https://hubermanlab.stanford.edu/publications/brief-structured-respiration-practices-enhance-mood-and-reduce-physiological-arousal',
      },
    ],
    durations: [2, 4, 6],
    defaultMinutes: 4,
    howTo: 'Hold to breathe in and keep holding through the pause. Let go to breathe out and stay released while resting.',
  },
  {
    id: 'count',
    kind: 'count',
    name: 'Count',
    tagline: 'Count nine breaths. Notice when you drift.',
    goal: 'Focus',
    why:
      'Counting breaths in cycles of nine is a classic focused-attention exercise and a research measure of mindfulness. Each time you notice your mind wandered and come back, you practise the core skill of attention.',
    sources: [
      {
        label: 'Breath counting as a measure of sustained attention',
        url: 'https://scholarworks.lib.csusb.edu/psychology-publications/15',
      },
      {
        label: 'MacLean et al. (2010): focused-attention training & sustained attention',
        url: 'https://pubmed.ncbi.nlm.nih.gov/20483826/',
      },
    ],
    durations: [3, 5, 10],
    defaultMinutes: 5,
    howTo: 'Breathe naturally. Tap on each out-breath. On the ninth, press and hold to close the circle.',
  },
  {
    id: 'pond',
    kind: 'pond',
    name: 'Pond',
    tagline: 'Touch the water. Nothing to win.',
    goal: 'Unwind',
    why:
      'Watching water, drifting lights and gentle patterns holds attention without effort ("soft fascination"). Attention Restoration Theory suggests this lets tired, directed attention recover. Natural sounds have also been linked to faster stress recovery.',
    sources: [
      { label: 'Attention Restoration Theory', url: 'https://en.wikipedia.org/wiki/Attention_restoration_theory' },
      {
        label: 'Alvarsson et al. (2010): stress recovery with nature sound',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2872309/',
      },
    ],
    durations: [3, 5, 10],
    defaultMinutes: 5,
    howTo: 'Touch or drag across the water. Each ripple makes a soft note. Stay as long as you like.',
  },
];

export const practice = (id: PracticeId) => PRACTICES.find((p) => p.id === id)!;
