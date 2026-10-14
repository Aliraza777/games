import { useEffect, useRef } from 'react';
import { prefersReducedMotion, useSettings } from '../store/settings';

export function useReducedMotion(): boolean {
  return prefersReducedMotion(useSettings((s) => s.reducedMotion));
}

type KeyMap = Record<string, ((e: KeyboardEvent) => void) | undefined>;

/** Simple key bindings; ignores auto-repeat and typing in inputs. */
export function useKeys(map: KeyMap, opts: { up?: KeyMap } = {}) {
  const down = useRef(map);
  const up = useRef(opts.up ?? {});
  down.current = map;
  up.current = opts.up ?? {};
  useEffect(() => {
    const name = (e: KeyboardEvent) => (e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return el?.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text';
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      const k = name(e);
      // Let Space/Enter activate a focused button natively.
      if ((k === 'Space' || k === 'Enter') && (e.target as HTMLElement)?.closest?.('button, a, [role="radio"], [role="switch"]')) return;
      const fn = down.current[k];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const fn = up.current[name(e)];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);
}

export function greeting(hour = new Date().getHours()): string {
  if (hour < 5) return 'Still awake?';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Winding down?';
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Phones and tablets: no hover, coarse pointer — copy and controls adapt. */
export function isTouchDevice(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Keep the screen awake while `active` — a phone shouldn't dim in the middle of
 * an eyes-closed breathing session. Re-acquired when you come back to the tab.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!active || !wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const s = await wl.request('screen');
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        /* denied (battery saver, etc.) — the session still works */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
