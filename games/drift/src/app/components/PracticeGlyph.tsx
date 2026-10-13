import type { PracticeId } from '../../breath/practices';

/** Small looping illustration for each practice card (CSS-animated, calm). */
export function PracticeGlyph({ id }: { id: PracticeId }) {
  return (
    <svg className={`glyph glyph-${id}`} viewBox="0 0 80 80" aria-hidden>
      {id === 'sigh' && (
        <>
          <circle cx="40" cy="40" r="26" className="g-ring" />
          <circle cx="40" cy="40" r="14" className="g-fill g-sigh" />
        </>
      )}
      {id === 'resonance' && (
        <>
          <path className="g-wave" d="M4 46 Q 22 30 40 46 T 76 46" />
          <path className="g-wave g-wave2" d="M4 54 Q 22 40 40 54 T 76 54" />
          <circle cx="40" cy="26" r="9" className="g-fill g-tide" />
        </>
      )}
      {id === 'box' && (
        <>
          <rect x="18" y="18" width="44" height="44" rx="6" className="g-ring" />
          <circle r="4.5" className="g-dot g-box" />
        </>
      )}
      {id === 'count' && (
        <g transform="translate(40 40)">
          {Array.from({ length: 9 }, (_, i) => {
            const a = -Math.PI / 2 + (i / 9) * Math.PI * 2;
            return (
              <circle
                key={i}
                cx={Math.cos(a) * 24}
                cy={Math.sin(a) * 24}
                r={i === 8 ? 3.4 : 2.6}
                className="g-star"
                style={{ animationDelay: `${i * 0.5}s` }}
              />
            );
          })}
        </g>
      )}
      {id === 'pond' && (
        <>
          <ellipse cx="40" cy="44" rx="10" ry="4" className="g-ripple" />
          <ellipse cx="40" cy="44" rx="10" ry="4" className="g-ripple" style={{ animationDelay: '1.3s' }} />
          <ellipse cx="40" cy="44" rx="10" ry="4" className="g-ripple" style={{ animationDelay: '2.6s' }} />
        </>
      )}
    </svg>
  );
}
