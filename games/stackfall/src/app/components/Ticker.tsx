import { useEffect, useRef, useState } from 'react';
import { fmtScore } from '../../lib/format';

/** A number that counts up smoothly to its new value. */
export function Ticker({ value, duration = 450 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const shownRef = useRef(value);
  useEffect(() => {
    from.current = shownRef.current;
    if (from.current === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / duration));
      const v = from.current + (value - from.current) * (1 - Math.pow(1 - k, 3));
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{fmtScore(shown)}</>;
}
