import { motion } from 'motion/react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { INKS, INK_ORDER } from '../../game/config';
import { Key } from './Button';

/** "Two hands, two jobs" — a visual cheat sheet instead of a wall of text. */
export function ControlsCard() {
  return (
    <div className="controls-card" aria-label="How to play">
      <div className="hand">
        <span className="hand-label">Left hand · drive</span>
        <div className="keys-wasd" aria-hidden>
          <Key>W</Key>
          <div>
            <Key>A</Key>
            <Key>S</Key>
            <Key>D</Key>
          </div>
        </div>
        <ul>
          <li>
            <Key>W</Key> gas · <Key>S</Key> brake
          </li>
          <li>
            <Key>A</Key> <Key>D</Key> lean & flip
          </li>
          <li>
            <Key wide>Space</Key> hop · <Key wide>Shift</Key> slow time
          </li>
        </ul>
      </div>
      <div className="hand">
        <span className="hand-label">Right hand · build</span>
        <svg className="mouse-art" viewBox="0 0 60 90" aria-hidden>
          <rect x="6" y="6" width="48" height="78" rx="24" className="mouse-body" />
          <path d="M30 6 V36 M6 36 H54" className="mouse-split" />
          <path d="M6 30 A24 24 0 0 1 30 6 V36 H6 Z" className="mouse-left" />
          <rect x="27" y="14" width="6" height="12" rx="3" className="mouse-wheel" />
        </svg>
        <ul>
          <li>
            <b>Hold & drag</b> to draw road
          </li>
          <li>
            <b>Right-click</b> to erase (half ink back)
          </li>
          <li>
            {INK_ORDER.map((k) => (
              <span key={k} className="ink-dot" style={{ background: INKS[k].color }} title={INKS[k].label} />
            ))}
            <Key>1</Key>
            <Key>2</Key>
            <Key>3</Key> or scroll for ink
          </li>
        </ul>
      </div>
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      {children}
    </div>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Row label={label}>
      <input
        className="slider"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        aria-label={label}
        style={{ '--fill': `${value * 100}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Row>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <Row label={label}>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
            {o.value === value && <motion.span layoutId={id} className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
            <span className="seg-label">{o.label}</span>
          </button>
        ))}
      </div>
    </Row>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label}>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
        <motion.span layout className="toggle-knob" transition={{ type: 'spring', stiffness: 600, damping: 30 }} />
      </button>
    </Row>
  );
}
