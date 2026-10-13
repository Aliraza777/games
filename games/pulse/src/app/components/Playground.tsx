import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type PointerEvent } from 'react';
import { audio } from '../../audio/AudioManager';
import { useSettings } from '../../store/settings';
import { CrosshairSvg } from './CrosshairSvg';

interface Burst {
  id: number;
  x: number;
  y: number;
}

/** Live preview in Settings: every change shows up here immediately. */
export function Playground() {
  const crosshair = useSettings((s) => s.crosshair);
  const targetScale = useSettings((s) => s.targetScale);
  const area = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState({ x: 0.5, y: 0.55 });
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [hits, setHits] = useState(0);
  const radius = 30 * targetScale;

  const onDown = (e: PointerEvent) => {
    const el = area.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const tx = target.x * r.width, ty = target.y * r.height;
    if (Math.hypot(x - tx, y - ty) > radius) return;
    audio.ensure();
    audio.hit(hits + 1, Math.hypot(x - tx, y - ty) < radius * 0.25);
    const id = Date.now();
    setBursts((b) => [...b.slice(-3), { id, x: tx, y: ty }]);
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 600);
    setHits((h) => h + 1);
    setTarget({ x: 0.15 + Math.random() * 0.7, y: 0.25 + Math.random() * 0.6 });
  };

  return (
    <div className="playground-wrap">
      <div
        ref={area}
        className="playground"
        onPointerMove={(e) => {
          const r = area.current!.getBoundingClientRect();
          setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onPointerLeave={() => setCursor(null)}
        onPointerDown={onDown}
      >
        <motion.div
          key={hits}
          className="pg-target"
          style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%`, width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
        >
          <span className="pg-target-inner" />
        </motion.div>
        <AnimatePresence>
          {bursts.map((b) => (
            <div key={b.id} className="pg-burst" style={{ left: b.x, top: b.y }}>
              {Array.from({ length: 8 }, (_, i) => (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos((i / 8) * Math.PI * 2) * 46,
                    y: Math.sin((i / 8) * Math.PI * 2) * 46,
                    opacity: 0,
                    scale: 0.3,
                  }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                />
              ))}
            </div>
          ))}
        </AnimatePresence>
        {cursor && (
          <div className="pg-cursor" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
            <CrosshairSvg c={crosshair} />
          </div>
        )}
        <div className="pg-caption">
          Live preview — click the target <span className="tnum">· {hits}</span>
        </div>
      </div>
      <div className="pg-zoom" aria-label="Crosshair close-up">
        <CrosshairSvg c={crosshair} scale={3} />
      </div>
    </div>
  );
}
