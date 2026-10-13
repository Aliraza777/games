import { motion } from 'motion/react';
import { useId, type CSSProperties, type ReactNode } from 'react';

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <span className="row-label">{label}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
  bare?: boolean;
}

export function Segmented<T extends string | number>({ label, value, options, onChange, hint, bare }: SegmentedProps<T>) {
  const id = useId();
  const group = (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? 'is-active' : ''}
            onClick={() => onChange(o.value)}
          >
            {active && <motion.span className="segmented-pill" layoutId={`seg-${id}`} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />}
            <span className="segmented-label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
  return bare ? group : <Row label={label} hint={hint}>{group}</Row>;
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Row label={label} hint={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <motion.span className="toggle-knob" layout transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
      </button>
    </Row>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  format = (v: number) => `${Math.round(v * 100)}%`,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <Row label={label}>
      <div className="slider">
        <input
          id={id}
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <output htmlFor={id}>{format(value)}</output>
      </div>
    </Row>
  );
}
