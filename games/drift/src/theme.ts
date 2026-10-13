export type ThemeId = 'dusk' | 'forest' | 'ember';

export interface Theme {
  label: string;
  description: string;
  /** [top, horizon] colors at night and at dawn — the sky brightens as a session progresses. */
  skyNight: [string, string];
  skyDawn: [string, string];
  water: [string, string];
  hills: [string, string];
  accent: string;
  accent2: string;
  glow: string;
  // UI
  bg: string;
  surface: string;
  text: string;
  muted: string;
}

/**
 * Low-saturation, low-contrast palettes. "Ember" avoids blue light for bedtime use.
 */
export const THEMES: Record<ThemeId, Theme> = {
  dusk: {
    label: 'Dusk',
    description: 'Cool blues into a peach sunrise',
    skyNight: ['#070b1d', '#1b2a4e'],
    skyDawn: ['#34507d', '#f0b9a0'],
    water: ['#0d2236', '#06111c'],
    hills: ['#0a1428', '#122039'],
    accent: '#9fd6dc',
    accent2: '#f6c9ae',
    glow: '#d9f3ff',
    bg: '#0a1020',
    surface: '#141c33',
    text: '#e9eef4',
    muted: '#93a1b6',
  },
  forest: {
    label: 'Forest',
    description: 'Deep greens and morning mist',
    skyNight: ['#050f0c', '#123026'],
    skyDawn: ['#3f6a5b', '#e9dcae'],
    water: ['#0b2420', '#04110e'],
    hills: ['#061410', '#0d241d'],
    accent: '#a9dbbd',
    accent2: '#f0d8a6',
    glow: '#e4ffe9',
    bg: '#07130f',
    surface: '#10231c',
    text: '#e8f1ea',
    muted: '#93ab9d',
  },
  ember: {
    label: 'Ember',
    description: 'Warm and dim — no blue light, for bedtime',
    skyNight: ['#0e0806', '#2a1510'],
    skyDawn: ['#5a2e1e', '#e3a06d'],
    water: ['#1c100b', '#0b0604'],
    hills: ['#140a07', '#22120c'],
    accent: '#f0b48a',
    accent2: '#ead09a',
    glow: '#ffe2c4',
    bg: '#100907',
    surface: '#1f130e',
    text: '#f4e6da',
    muted: '#b39a8a',
  },
};

export function applyTheme(id: ThemeId) {
  const t = THEMES[id] ?? THEMES.dusk;
  const s = document.documentElement.style;
  s.setProperty('--bg', t.bg);
  s.setProperty('--surface', t.surface);
  s.setProperty('--text', t.text);
  s.setProperty('--muted', t.muted);
  s.setProperty('--accent', t.accent);
  s.setProperty('--accent2', t.accent2);
  s.setProperty('--glow', t.glow);
  s.setProperty('--sky-top', t.skyNight[0]);
  s.setProperty('--sky-bottom', t.skyNight[1]);
  document.documentElement.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
}
