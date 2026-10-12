import { motion } from 'motion/react';
import { useMemo } from 'react';

const COLORS = ['var(--accent)', 'var(--accent2)', 'var(--warm)', 'var(--hot)', 'var(--good)'];

/** Short, celebratory, and gone in under two seconds. */
export function Confetti({ count = 46 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 900,
        y: 300 + Math.random() * 400,
        r: (Math.random() - 0.5) * 720,
        delay: Math.random() * 0.15,
        w: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          style={{ background: p.color, width: p.w, height: p.w * 0.45 }}
          initial={{ x: 0, y: -40, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: [-40, -160 - Math.random() * 120, p.y], rotate: p.r, opacity: [1, 1, 0] }}
          transition={{ duration: 1.6, delay: p.delay, ease: [0.2, 0.7, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
