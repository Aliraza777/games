import { clamp, mean, median } from '../../lib/math';
import type { Histogram as HistogramData, Vec } from '../../game/types';

// ─── heatmap ───────────────────────────────────────────────────────────────

const DIRS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];

export function describeBias(points: Vec[]): string {
  if (points.length < 5) return 'Not enough hits to read a pattern yet.';
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  const m = Math.hypot(mx, my);
  if (m < 0.1) return 'Nicely centered — no aim bias.';
  const idx = Math.round(Math.atan2(my, mx) / (Math.PI / 4));
  const dir = DIRS[(idx + 8) % 8];
  return `You tend to land ${m < 0.25 ? 'slightly' : 'noticeably'} ${dir} of center.`;
}

/** Every click plotted against a normalized target. */
export function Heatmap({ points, label }: { points: Vec[]; label: string }) {
  const S = 220;
  const C = S / 2;
  const R = 64;
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  return (
    <figure className="chart">
      <figcaption>{label}</figcaption>
      <svg viewBox={`0 0 ${S} ${S}`} className="heatmap" role="img" aria-label={`${label}. ${describeBias(points)}`}>
        <circle cx={C} cy={C} r={R * 1.6} className="hm-zone" />
        <circle cx={C} cy={C} r={R} className="hm-ring" />
        <circle cx={C} cy={C} r={R * 0.5} className="hm-ring hm-faint" />
        <circle cx={C} cy={C} r={R * 0.25} className="hm-perfect" />
        <path d={`M${C} ${C - R * 1.6}V${C + R * 1.6}M${C - R * 1.6} ${C}H${C + R * 1.6}`} className="hm-axis" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={C + clamp(p.x, -1.6, 1.6) * R}
            cy={C + clamp(p.y, -1.6, 1.6) * R}
            r={3}
            className="hm-dot"
            style={{ animationDelay: `${Math.min(i * 6, 900)}ms` }}
          />
        ))}
        {points.length >= 5 && (
          <g transform={`translate(${C + clamp(mx, -1.6, 1.6) * R} ${C + clamp(my, -1.6, 1.6) * R})`} className="hm-mean">
            <path d="M-7 0H7M0 -7V7" />
            <circle r="4" />
          </g>
        )}
      </svg>
      <p className="chart-note">{describeBias(points)}</p>
    </figure>
  );
}

// ─── histogram ─────────────────────────────────────────────────────────────

export function Histogram({ data }: { data: HistogramData }) {
  const BINS = 14;
  const W = 300, H = 140, PAD = 20;
  const bins = new Array(BINS).fill(0);
  for (const v of data.values) {
    const i = clamp(Math.floor(((v - data.min) / (data.max - data.min)) * BINS), 0, BINS - 1);
    bins[i]++;
  }
  const peak = Math.max(1, ...bins);
  const bw = (W - PAD * 2) / BINS;
  const x = (v: number) => PAD + ((clamp(v, data.min, data.max) - data.min) / (data.max - data.min)) * (W - PAD * 2);
  const med = median(data.values);
  const medX = x(med);
  const hasMedian = data.values.length > 0;
  // Hide an axis label rather than let the median label sit on top of it.
  const showMin = !hasMedian || medX - PAD > 28;
  const showMax = !hasMedian || W - PAD - medX > 56;
  return (
    <figure className="chart">
      <figcaption>{data.label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="histogram" role="img" aria-label={`${data.label}, median ${Math.round(med)} ${data.unit}`}>
        {bins.map((n, i) => {
          const h = (n / peak) * (H - 10);
          return (
            <rect
              key={i}
              x={PAD + i * bw + 1.5}
              y={H - h}
              width={bw - 3}
              height={Math.max(h, n ? 2 : 0)}
              rx={3}
              className="hist-bar"
              style={{ animationDelay: `${i * 30}ms` }}
            />
          );
        })}
        <line x1={PAD} x2={W - PAD} y1={H} y2={H} className="hist-base" />
        {data.center != null && <line x1={x(data.center)} x2={x(data.center)} y1={4} y2={H} className="hist-center" />}
        {hasMedian && (
          <g className="hist-median">
            <line x1={medX} x2={medX} y1={4} y2={H} />
            <text x={medX} y={H + 14} textAnchor="middle">
              {Math.round(med)}
            </text>
          </g>
        )}
        {showMin && (
          <text x={PAD} y={H + 14} className="hist-axis">
            {data.min}
          </text>
        )}
        {showMax && (
          <text x={W - PAD} y={H + 14} textAnchor="end" className="hist-axis">
            {data.max} {data.unit}
          </text>
        )}
      </svg>
      <p className="chart-note">
        {data.values.length ? `Median ${Math.round(med)} ${data.unit}` : 'No data this run.'}
      </p>
    </figure>
  );
}

// ─── sparkline ─────────────────────────────────────────────────────────────

export function Sparkline({ values, width = 160, height = 40 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <div className="spark-empty">Play a couple of runs to see a trend</div>;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 6) + 3, height - 4 - ((v - lo) / span) * (height - 8)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="spark" aria-hidden>
      <path d={`${line}L${lx} ${height}L3 ${height}Z`} className="spark-area" />
      <path d={line} className="spark-line" />
      <circle cx={lx} cy={ly} r={3} className="spark-dot" />
    </svg>
  );
}
