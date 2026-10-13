/** Keep game rules as pure functions so they're easy to test. */
export function nextScore(score: number, hit: boolean): number {
  return hit ? score + 1 : Math.max(0, score - 1);
}
