/**
 * 0–10 self-rating (like the Subjective Units of Distress scale). Optional —
 * nothing is selected until you choose.
 */
export function TensionScale({
  value,
  onChange,
  label,
  before,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  before?: number | null;
}) {
  return (
    <fieldset className="tension">
      <legend>{label}</legend>
      <div className="tension-scale" role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i}${i === 0 ? ' — completely calm' : i === 10 ? ' — extremely tense' : ''}`}
            className={`tension-dot${value === i ? ' is-active' : ''}${before === i ? ' is-before' : ''}`}
            style={{ ['--i' as string]: i }}
            onClick={() => onChange(value === i ? null : i)}
            onKeyDown={(e) => {
              const cur = value ?? 5;
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(Math.min(10, cur + 1));
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(Math.max(0, cur - 1));
              }
            }}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="tension-ends" aria-hidden>
        <span>Calm</span>
        <span>Very tense</span>
      </div>
    </fieldset>
  );
}
