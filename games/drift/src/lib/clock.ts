/**
 * Session time multiplier. `?speed=20` fast-forwards sessions in development so
 * end-to-end tests can finish a five-minute practice in seconds. Ignored in
 * production builds.
 */
let speed = 1;

export function initSpeedFromUrl(search = typeof location === 'undefined' ? '' : location.search) {
  if (!import.meta.env.DEV) return;
  const s = Number(new URLSearchParams(search).get('speed'));
  if (s > 0 && s <= 200) speed = s;
}

export const getSpeed = () => speed;
export const setSpeed = (s: number) => {
  speed = s;
};

export function buzz(ms: number | number[], enabled: boolean) {
  if (enabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

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
