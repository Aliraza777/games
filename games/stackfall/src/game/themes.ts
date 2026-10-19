import type { PieceType } from './pieces';

export type BlockStyle = 'gloss' | 'flat' | 'neon' | 'pixel';

export interface Theme {
  id: string;
  name: string;
  /** Lifetime lines cleared needed to unlock. */
  unlock: number;
  style: BlockStyle;
  colors: Record<PieceType, string>;
  /** Well background (top → bottom) and grid colour. */
  well: [string, string];
  grid: string;
  accent: string;
}

export const THEMES: Theme[] = [
  {
    id: 'neon', name: 'Neon', unlock: 0, style: 'gloss',
    colors: { I: '#2fe6ff', J: '#3f6dff', L: '#ff9a2e', O: '#ffd23f', S: '#3ce283', T: '#b866ff', Z: '#ff4f6e' },
    well: ['#0b0e1f', '#070812'], grid: 'rgba(120,140,255,0.07)', accent: '#2fe6ff',
  },
  {
    id: 'candy', name: 'Candy', unlock: 40, style: 'gloss',
    colors: { I: '#7fe7f2', J: '#8ea8ff', L: '#ffb38a', O: '#ffe28a', S: '#9ef0b5', T: '#d7a8ff', Z: '#ff9fb4' },
    well: ['#1c1328', '#120c1b'], grid: 'rgba(255,190,230,0.07)', accent: '#ff9fd0',
  },
  {
    id: 'ink', name: 'Ink', unlock: 120, style: 'flat',
    colors: { I: '#f2f2f2', J: '#c9c9c9', L: '#e0e0e0', O: '#ffffff', S: '#bdbdbd', T: '#d6d6d6', Z: '#a8a8a8' },
    well: ['#111111', '#050505'], grid: 'rgba(255,255,255,0.06)', accent: '#ffffff',
  },
  {
    id: 'retro', name: 'Pocket', unlock: 250, style: 'pixel',
    colors: { I: '#9bbc0f', J: '#8bac0f', L: '#9bbc0f', O: '#8bac0f', S: '#9bbc0f', T: '#8bac0f', Z: '#9bbc0f' },
    well: ['#1d2b12', '#0f1a0b'], grid: 'rgba(155,188,15,0.08)', accent: '#9bbc0f',
  },
  {
    id: 'aurora', name: 'Aurora', unlock: 500, style: 'neon',
    colors: { I: '#00fff0', J: '#4d7cff', L: '#ff8c42', O: '#fff35c', S: '#4dff9a', T: '#e070ff', Z: '#ff3d7f' },
    well: ['#03101a', '#020409'], grid: 'rgba(0,255,240,0.06)', accent: '#00fff0',
  },
  {
    id: 'gold', name: 'Gilded', unlock: 1000, style: 'gloss',
    colors: { I: '#ffe08a', J: '#e8b04a', L: '#ffcf6b', O: '#fff1b8', S: '#d9a441', T: '#f5c35c', Z: '#c98f2e' },
    well: ['#1a1408', '#0c0904'], grid: 'rgba(255,210,120,0.07)', accent: '#ffd36b',
  },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
