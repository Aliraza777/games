import { useEffect, useRef, useState } from 'react';
import { useHistory } from '../store/history';
import { prefersReducedMotion, useSettings } from '../store/settings';

/** True once persisted settings and history have loaded from IndexedDB. */
export function useHydrated(): boolean {
  const check = () => useSettings.persist.hasHydrated() && useHistory.persist.hasHydrated();
  const [hydrated, setHydrated] = useState(check);
  useEffect(() => {
    const update = () => setHydrated(check());
    const a = useSettings.persist.onFinishHydration(update);
    const b = useHistory.persist.onFinishHydration(update);
    update();
    return () => {
      a();
      b();
    };
  }, []);
  return hydrated;
}

export function useReducedMotion(): boolean {
  const setting = useSettings((s) => s.reducedMotion);
  return prefersReducedMotion(setting);
}

type KeyMap = Record<string, ((e: KeyboardEvent) => void) | undefined>;

const normalize = (e: KeyboardEvent) => (e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key);

/**
 * Keyboard-first controls. Keys are 'Space', 'Escape', 'Enter' or lowercase letters;
 * '*' catches anything unmatched. Space/Enter are left alone on focused buttons
 * so native activation still works.
 */
export function useHotkeys(map: KeyMap) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' && (el as HTMLInputElement).type !== 'range' && (el as HTMLInputElement).type !== 'checkbox') return;
      const key = normalize(e);
      if ((key === 'Space' || key === 'Enter') && (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT')) return;
      const fn = ref.current[key] ?? ref.current['*'];
      if (!fn) return;
      if (key !== '*' && ref.current[key]) e.preventDefault();
      fn(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
