import { motion, useSpring } from 'motion/react';
import { useState, type CSSProperties } from 'react';
import { audio } from '../../audio/AudioManager';
import type { ModeMeta } from '../../game/modes/meta';
import { fmtInt } from '../../lib/format';
import { hex, palettes } from '../../theme/palettes';
import { riseIn } from '../../theme/motion';
import { useSettings } from '../../store/settings';
import { ModePreview } from './ModePreview';

interface Props {
  meta: ModeMeta;
  best: number | null;
  onPlay: () => void;
}

/** Tilts toward the cursor; its backdrop morphs into the play field on start. */
export function ModeCard({ meta, best, onPlay }: Props) {
  const palette = useSettings((s) => s.palette);
  const [active, setActive] = useState(false);
  const rx = useSpring(0, { stiffness: 300, damping: 25 });
  const ry = useSpring(0, { stiffness: 300, damping: 25 });
  const hue = hex(palettes[palette][meta.hue]);

  return (
    <motion.button
      type="button"
      className="mode-card"
      variants={riseIn}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, '--hue': hue } as CSSProperties & Record<string, unknown>}
      whileTap={{ scale: 0.98 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 10);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10);
      }}
      onPointerEnter={() => {
        setActive(true);
        audio.uiHover();
      }}
      onPointerLeave={() => {
        setActive(false);
        rx.set(0);
        ry.set(0);
      }}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      onClick={() => {
        audio.ensure();
        audio.uiClick();
        onPlay();
      }}
      aria-label={`Play ${meta.name} — ${meta.skill}`}
    >
      <motion.div className="mode-card-bg" layoutId={`card-${meta.id}`} />
      <div className="mode-card-preview">
        <ModePreview mode={meta.id} playing={active} />
      </div>
      <div className="mode-card-body">
        <div className="mode-card-head">
          <h3>{meta.name}</h3>
          <span className="chip">{meta.skill}</span>
        </div>
        <p className="mode-card-tagline">{meta.tagline}</p>
        <div className="mode-card-foot">
          {meta.recorded ? (
            best != null ? (
              <span>
                Best <strong className="tnum">{fmtInt(best)}</strong>
              </span>
            ) : (
              <span className="muted">Not played yet</span>
            )
          ) : (
            <span className="muted">Untimed</span>
          )}
          <span className="mode-card-go" aria-hidden>
            Play →
          </span>
        </div>
      </div>
    </motion.button>
  );
}
