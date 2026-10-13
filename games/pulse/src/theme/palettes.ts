export type PaletteId = 'default' | 'deuteranopia' | 'protanopia' | 'tritanopia' | 'high-contrast';

export interface Palette {
  label: string;
  bg: number;
  bg2: number;
  surface: number;
  text: number;
  muted: number;
  accent: number;
  accent2: number;
  warm: number;
  hot: number;
  cool: number;
  good: number;
  bad: number;
}

export type PaletteColor = Exclude<keyof Palette, 'label'>;

/**
 * Single source of truth for color. The game reads these as numbers, the UI
 * reads them as CSS variables (see applyPalette).
 */
export const palettes: Record<PaletteId, Palette> = {
  default: {
    label: 'Neon',
    bg: 0x0b0d17,
    bg2: 0x141833,
    surface: 0x1a1f3d,
    text: 0xeef0ff,
    muted: 0x8a90b8,
    accent: 0x5ee6ff,
    accent2: 0xa78bfa,
    warm: 0xffb35c,
    hot: 0xff5c8a,
    cool: 0x5c7cff,
    good: 0x6cf5b0,
    bad: 0xff6b6b,
  },
  deuteranopia: {
    label: 'Deuteranopia',
    bg: 0x0b0d17,
    bg2: 0x141833,
    surface: 0x1a1f3d,
    text: 0xeef0ff,
    muted: 0x8a90b8,
    accent: 0x64b5ff,
    accent2: 0x9d8cff,
    warm: 0xffb000,
    hot: 0xfe6100,
    cool: 0x648fff,
    good: 0x4fd1ff,
    bad: 0xfe6100,
  },
  protanopia: {
    label: 'Protanopia',
    bg: 0x0b0d17,
    bg2: 0x141833,
    surface: 0x1a1f3d,
    text: 0xeef0ff,
    muted: 0x8a90b8,
    accent: 0x4fc3ff,
    accent2: 0x8f7bff,
    warm: 0xffc233,
    hot: 0xffd966,
    cool: 0x4f6bff,
    good: 0x4fc3ff,
    bad: 0xffc233,
  },
  tritanopia: {
    label: 'Tritanopia',
    bg: 0x0d0b12,
    bg2: 0x1a1420,
    surface: 0x241c2c,
    text: 0xf5eef2,
    muted: 0xa8909c,
    accent: 0xff6b9d,
    accent2: 0x00c2b8,
    warm: 0xff8a5c,
    hot: 0xff2e63,
    cool: 0x00c2b8,
    good: 0x00d1c1,
    bad: 0xff4d6d,
  },
  'high-contrast': {
    label: 'High contrast',
    bg: 0x000000,
    bg2: 0x0a0a0a,
    surface: 0x161616,
    text: 0xffffff,
    muted: 0xc8c8c8,
    accent: 0xffff00,
    accent2: 0x00ffff,
    warm: 0xff9900,
    hot: 0xff00ff,
    cool: 0x00aaff,
    good: 0x00ff66,
    bad: 0xff3333,
  },
};

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const rgbTriplet = (n: number) => `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;

const COLOR_KEYS: PaletteColor[] = [
  'bg', 'bg2', 'surface', 'text', 'muted', 'accent', 'accent2', 'warm', 'hot', 'cool', 'good', 'bad',
];

export function applyPalette(id: PaletteId) {
  const p = palettes[id] ?? palettes.default;
  const root = document.documentElement.style;
  for (const key of COLOR_KEYS) {
    root.setProperty(`--${key}`, hex(p[key]));
    root.setProperty(`--${key}-rgb`, rgbTriplet(p[key]));
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex(p.bg));
}
