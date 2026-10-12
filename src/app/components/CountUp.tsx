import { animate } from 'motion/react';
import { useEffect, useRef } from 'react';
import { fmtInt } from '../../lib/format';

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
  /** Jump straight to the final value (any key on the results screen). */
  skip?: boolean;
}

/** Counts up with tabular figures so digits don't jitter. */
export function CountUp({ value, format = fmtInt, duration = 1, delay = 0, skip = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (skip) {
      el.textContent = fmt.current(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = fmt.current(v);
      },
    });
    return () => controls.stop();
  }, [value, skip, duration, delay]);

  return (
    <span ref={ref} className="tnum">
      {format(skip ? value : 0)}
    </span>
  );
}
