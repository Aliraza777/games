import type { BikeSkin } from '../../game/config';

/** Side-view bike preview in a skin's colours (garage, title). */
export function BikeArt({ skin, locked }: { skin: BikeSkin; locked?: boolean }) {
  const spokes = Array.from({ length: skin.spokes }, (_, i) => (i / skin.spokes) * Math.PI * 2);
  const wheel = (cx: number) => (
    <g className="ba-wheel" style={{ transformOrigin: `${cx}px 46px` }}>
      <circle cx={cx} cy={46} r={12} fill="#000" stroke={skin.body} strokeWidth={3} />
      {spokes.map((a, i) => (
        <line key={i} x1={cx} y1={46} x2={cx + Math.cos(a) * 9} y2={46 + Math.sin(a) * 9} stroke={skin.accent} strokeWidth={2} />
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 120 64" className={`bike-art${locked ? ' is-locked' : ''}`} aria-hidden>
      {wheel(26)}
      {wheel(92)}
      <path d="M26 46 L48 32 L78 30 L92 46 M78 30 L84 20 M48 32 L58 44 L26 46" fill="none" stroke={skin.body} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M40 30 L64 30 L60 36 L42 36 Z" fill={skin.accent} />
      <path d="M48 30 L54 12 L82 22 M48 30 L62 40" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={56} cy={8} r={6.5} fill={skin.accent} />
    </svg>
  );
}
