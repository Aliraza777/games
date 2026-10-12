import { motion } from 'motion/react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { spring } from '../../theme/motion';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-text">
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}

export function Slider({ label, value, min, max, step, onChange, format = String, hint }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="field">
      <div className="field-text">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      <div className="field-control slider">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ '--fill': `${pct}%` } as CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <output htmlFor={id} className="slider-value tnum">
          {format(value)}
        </output>
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <motion.span className="toggle-knob" layout transition={spring.bouncy} />
      </button>
    </Field>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}

/** The selected pill slides between options. */
export function Segmented<T extends string | number>({ label, value, options, onChange, hint }: SegmentedProps<T>) {
  const id = useId();
  return (
    <Field label={label} hint={hint}>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'is-active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.value === value && <motion.span className="segmented-pill" layoutId={`seg-${id}`} transition={spring.snappy} />}
            <span className="segmented-label">{o.label}</span>
          </button>
        ))}
      </div>
    </Field>
  );
}

export function Swatches({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (c: string) => void }) {
  return (
    <Field label={label}>
      <div className="swatches" role="radiogroup" aria-label={label}>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === value}
            aria-label={c}
            className={`swatch${c === value ? ' is-active' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </Field>
  );
}
