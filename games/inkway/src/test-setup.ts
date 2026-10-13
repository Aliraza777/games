import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Node ≥ 22 can shadow jsdom's localStorage; point the global back at jsdom's.
const jsdomStorage = (globalThis as { jsdom?: { window: Window } }).jsdom?.window.localStorage;
if (jsdomStorage && typeof globalThis.localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', { value: jsdomStorage, configurable: true, writable: true });
}

// jsdom has no canvas: the renderer treats a missing context as "draw nothing".
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
afterEach(() => {
  if (typeof document !== 'undefined') cleanup();
});
