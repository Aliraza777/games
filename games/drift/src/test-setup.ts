import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Node ≥ 25 ships its own (file-backed, here unusable) `localStorage` global that
// shadows jsdom's. Point the global back at jsdom's so persistence works like a browser.
const jsdomStorage = (globalThis as { jsdom?: { window: Window } }).jsdom?.window.localStorage;
if (jsdomStorage && typeof globalThis.localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', { value: jsdomStorage, configurable: true, writable: true });
}

// jsdom has no canvas; the scene treats a missing context as "render nothing".
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

// motion uses matchMedia/IntersectionObserver in places jsdom doesn't provide.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
