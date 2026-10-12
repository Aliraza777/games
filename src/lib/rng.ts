export type Rng = () => number;

/** Small, fast, seedable PRNG. Same seed → same run (daily challenge, replays). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const randInt = (rng: Rng, min: number, maxExclusive: number) => Math.floor(randRange(rng, min, maxExclusive));
export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

export function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

/** YYYYMMDD in local time — everyone on the same day gets the same seed. */
export function dailySeed(date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}
