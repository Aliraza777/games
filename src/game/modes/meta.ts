import type { PaletteColor } from '../../theme/palettes';
import type { ModeId } from '../types';

/** UI-facing mode info. Kept free of engine imports so menus don't pull in PixiJS. */
export interface ModeMeta {
  id: ModeId;
  name: string;
  skill: string;
  tagline: string;
  howTo: string;
  hue: PaletteColor;
  /** Zen is the only mode that isn't scored or saved. */
  recorded: boolean;
}

export const MODES: ModeMeta[] = [
  {
    id: 'flick',
    name: 'Flick',
    skill: 'Speed + accuracy',
    tagline: 'Targets bloom. You pop them.',
    howTo: 'Click each target as fast as you can. Dead-center hits are perfects.',
    hue: 'accent',
    recorded: true,
  },
  {
    id: 'track',
    name: 'Track',
    skill: 'Smooth tracking',
    tagline: 'Stay on the orb. Feel the hum.',
    howTo: 'Keep your crosshair on the moving orb. No clicking needed.',
    hue: 'good',
    recorded: true,
  },
  {
    id: 'precision',
    name: 'Precision',
    skill: 'Fine control',
    tagline: 'Small rings. Dead center.',
    howTo: 'Targets shrink as time runs out. Center hits slow time down.',
    hue: 'accent2',
    recorded: true,
  },
  {
    id: 'reflex',
    name: 'Reflex',
    skill: 'Reaction time',
    tagline: 'Wait for it…',
    howTo: 'When the world freezes and a target flashes in — click it. Clicking early costs you.',
    hue: 'warm',
    recorded: true,
  },
  {
    id: 'flow',
    name: 'Flow',
    skill: 'Everything, on beat',
    tagline: 'Aim to the music.',
    howTo: 'Click each target as its outer ring closes in — right on the beat.',
    hue: 'hot',
    recorded: true,
  },
  {
    id: 'zen',
    name: 'Zen',
    skill: 'Warm-up',
    tagline: 'No timer. No score. Just aim.',
    howTo: 'Drift, click, breathe. Press Esc whenever you’re done.',
    hue: 'cool',
    recorded: false,
  },
];

export const modeMeta = (id: ModeId) => MODES.find((m) => m.id === id)!;

/** Modes eligible for the daily challenge (rotates by date). */
export const DAILY_MODES: ModeId[] = ['flick', 'precision', 'flow', 'track', 'reflex'];
