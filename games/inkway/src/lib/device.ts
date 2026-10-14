import { useEffect, useState } from 'react';

/** Phones and tablets: no hover, coarse pointer. */
export function isTouchDevice(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export function usePortrait(): boolean {
  const q = () => typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches;
  const [portrait, setPortrait] = useState(q);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia('(orientation: portrait)');
    const on = () => setPortrait(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return portrait;
}

/**
 * setPointerCapture throws if the pointer is already gone (a very quick tap,
 * a cancelled touch). Capture is a nicety — never let it abort input handling.
 */
export function capturePointer(el: Element | null, pointerId: number) {
  try {
    el?.setPointerCapture?.(pointerId);
  } catch {
    /* pointer already released */
  }
}
