export const TAU = Math.PI * 2;
export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
/** Frame-rate independent smoothing towards `b`. */
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function mean(xs: readonly number[]): number {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function lerpRgb(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
