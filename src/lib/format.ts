const intFmt = new Intl.NumberFormat('en-US');

export const fmtInt = (n: number) => intFmt.format(Math.round(n));
export const fmtPct = (n: number) => `${Math.round(n * 100)}%`;
export const fmtMs = (n: number | null) => (n == null ? '—' : `${Math.round(n)} ms`);

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtRelativeDay(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}
