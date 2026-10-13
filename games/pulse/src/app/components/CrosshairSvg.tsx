import type { CrosshairSettings } from '../../store/settings';

/** SVG twin of game/entities/Crosshair — keep the geometry in sync. */
export function CrosshairSvg({ c, scale = 1 }: { c: CrosshairSettings; scale?: number }) {
  const ext = c.size + c.gap + c.thickness + 4;
  const th = c.thickness;
  const half = th / 2;
  const shapes = (e: number, fill: string, opacity: number) => (
    <g fill={fill} stroke={fill} opacity={opacity}>
      {(c.shape === 'cross' || c.shape === 'cross-dot') && (
        <g stroke="none">
          <rect x={c.gap - e} y={-half - e} width={c.size + 2 * e} height={th + 2 * e} />
          <rect x={-c.gap - c.size - e} y={-half - e} width={c.size + 2 * e} height={th + 2 * e} />
          <rect x={-half - e} y={-c.gap - c.size - e} width={th + 2 * e} height={c.size + 2 * e} />
          <rect x={-half - e} y={c.gap - e} width={th + 2 * e} height={c.size + 2 * e} />
        </g>
      )}
      {c.shape === 'cross-dot' && <circle r={Math.max(1, th * 0.75) + e} stroke="none" />}
      {c.shape === 'dot' && <circle r={Math.max(2, c.size * 0.35) + e} stroke="none" />}
      {c.shape === 'circle' && (
        <>
          <circle r={c.size + c.gap} fill="none" strokeWidth={th + 2 * e} />
          <circle r={Math.max(1, th * 0.75) + e} stroke="none" />
        </>
      )}
    </g>
  );
  return (
    <svg
      width={ext * 2 * scale}
      height={ext * 2 * scale}
      viewBox={`${-ext} ${-ext} ${ext * 2} ${ext * 2}`}
      className="crosshair-svg"
      aria-hidden
    >
      {c.outline && shapes(1, '#000', 0.7)}
      {shapes(0, c.color, 1)}
    </svg>
  );
}
