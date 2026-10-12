import type { ReactNode } from 'react';
import type { ModeId } from '../../game/types';

/**
 * Tiny looping SVG demos of each mode. Animations are CSS-driven and paused
 * until the card is hovered/focused; negative delays mean the paused frame
 * still looks alive.
 */
export function ModePreview({ mode, playing }: { mode: ModeId; playing: boolean }) {
  return (
    <svg className={`preview preview-${mode}${playing ? ' playing' : ''}`} viewBox="0 0 160 90" aria-hidden>
      {PREVIEWS[mode]}
    </svg>
  );
}

const Cross = () => (
  <g className="pv-cross">
    <path d="M-7 0h4M3 0h4M0 -7v4M0 3v4" />
  </g>
);

const PREVIEWS: Record<ModeId, ReactNode> = {
  flick: (
    <>
      {[
        [40, 30, -0.5],
        [120, 58, -1.16],
        [78, 68, -1.83],
      ].map(([x, y, d]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <g className="pv-bloom" style={{ animationDelay: `${d}s` }}>
            <circle r="10" className="pv-fill" />
            <circle r="10" className="pv-ring" />
            <circle r="3" className="pv-dot" />
          </g>
        </g>
      ))}
      <g className="pv-flick-aim">
        <Cross />
      </g>
    </>
  ),
  track: (
    <>
      <path className="pv-path" d="M10 60 C 25 20, 40 18, 45 22 S 70 30, 80 35 S 98 62, 105 62 S 128 58, 135 55 S 148 34, 150 30" />
      <g className="pv-track-orb">
        <circle r="13" className="pv-glow" />
        <circle r="8" className="pv-solid" />
      </g>
      <g className="pv-track-aim">
        <Cross />
      </g>
    </>
  ),
  precision: (
    <g transform="translate(80 45)">
      <g className="pv-shrink">
        <circle r="24" className="pv-ring" />
        <circle r="16" className="pv-ring pv-faint" />
        <circle r="8" className="pv-ring pv-faint" />
        <circle r="2.5" className="pv-dot" />
      </g>
      <Cross />
    </g>
  ),
  reflex: (
    <>
      <circle cx="80" cy="45" r="38" className="pv-breathe" />
      <g transform="translate(104 34)">
        <g className="pv-flash">
          <circle r="11" className="pv-fill" />
          <circle r="11" className="pv-ring" />
        </g>
      </g>
      <text x="80" y="80" className="pv-ms">
        187 ms
      </text>
    </>
  ),
  flow: (
    <>
      <path className="pv-link" d="M30 62 L58 30 L102 30 L130 62" />
      {[
        [30, 62, -1.5],
        [58, 30, -1.0],
        [102, 30, -0.5],
        [130, 62, 0],
      ].map(([x, y, d]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <circle r="9" className="pv-approach" style={{ animationDelay: `${d}s` }} />
          <g className="pv-beat" style={{ animationDelay: `${d}s` }}>
            <circle r="9" className="pv-fill" />
            <circle r="9" className="pv-ring" />
          </g>
        </g>
      ))}
    </>
  ),
  zen: (
    <>
      {[
        [45, 40, 14, 0],
        [108, 30, 11, -2],
        [92, 66, 9, -4],
      ].map(([x, y, r, d]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <g className="pv-drift" style={{ animationDelay: `${d}s` }}>
            <circle r={r * 1.6} className="pv-glow" />
            <circle r={r} className="pv-fill" />
          </g>
        </g>
      ))}
    </>
  ),
};
