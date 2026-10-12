import { motion } from 'motion/react';
import { useState, type CSSProperties } from 'react';
import { MODES, modeMeta } from '../../game/modes/meta';
import { consistency } from '../../game/scoring/scoring';
import { fmtDuration, fmtInt, fmtPct, fmtRelativeDay } from '../../lib/format';
import { mean } from '../../lib/math';
import { useApp } from '../../store/app';
import { runsFor, useHistory, type StoredRun } from '../../store/history';
import { useSettings } from '../../store/settings';
import { hex, palettes } from '../../theme/palettes';
import { pageVariants, riseIn, staggerChildren } from '../../theme/motion';
import { Button } from '../components/Button';
import { Sparkline } from '../components/Charts';
import { IconBack, IconPlay } from '../components/Icons';
import { useHotkeys } from '../hooks';

function trend(runs: StoredRun[]): number | null {
  if (runs.length < 6) return null;
  const recent = mean(runs.slice(-3).map((r) => r.score));
  const before = mean(runs.slice(-6, -3).map((r) => r.score));
  return before ? (recent - before) / before : null;
}

export function Stats() {
  const runs = useHistory((s) => s.runs);
  const clear = useHistory((s) => s.clear);
  const palette = useSettings((s) => s.palette);
  const { go, startRun } = useApp.getState();
  const [confirm, setConfirm] = useState(false);

  useHotkeys({ Escape: () => go('home') });

  const totalTime = runs.reduce((s, r) => s + r.duration, 0);
  const counts = MODES.map((m) => [m, runsFor(runs, m.id).length] as const).sort((a, b) => b[1] - a[1]);
  const favorite = counts[0]?.[1] ? counts[0][0].name : '—';
  const recent = runs.slice(-8).reverse();

  return (
    <motion.main className="screen page" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <header className="page-head">
        <Button variant="subtle" icon={<IconBack />} kbd="Esc" onClick={() => go('home')}>
          Back
        </Button>
        <h1>Your progress</h1>
      </header>

      {runs.length === 0 ? (
        <motion.div className="empty" variants={riseIn} initial="initial" animate="animate">
          <svg viewBox="0 0 200 80" className="empty-art" aria-hidden>
            <path d="M5 70 C 40 70, 50 40, 80 45 S 130 20, 195 10" />
          </svg>
          <h2>Nothing here yet</h2>
          <p className="muted">Your progress will draw itself here after your first run.</p>
          <Button variant="primary" icon={<IconPlay />} onClick={() => startRun('flick')}>
            Start with Flick
          </Button>
        </motion.div>
      ) : (
        <motion.div className="stats" variants={staggerChildren(0.05)} initial="initial" animate="animate">
          <motion.section className="stat-tiles" variants={riseIn}>
            <div className="tile">
              <span className="tile-label">Runs</span>
              <span className="tile-value tnum">{fmtInt(runs.length)}</span>
            </div>
            <div className="tile">
              <span className="tile-label">Time trained</span>
              <span className="tile-value">{fmtDuration(totalTime)}</span>
            </div>
            <div className="tile">
              <span className="tile-label">Favorite mode</span>
              <span className="tile-value">{favorite}</span>
            </div>
            <div className="tile">
              <span className="tile-label">S grades</span>
              <span className="tile-value tnum">{runs.filter((r) => r.grade === 'S').length}</span>
            </div>
          </motion.section>

          <motion.section className="mode-stats" variants={staggerChildren(0.05)}>
            {MODES.filter((m) => m.recorded).map((m) => {
              const mr = runsFor(runs, m.id);
              const last = mr.slice(-20);
              const best = mr.length ? Math.max(...mr.map((r) => r.score)) : null;
              const tr = trend(mr);
              return (
                <motion.article
                  key={m.id}
                  className="mode-stat"
                  variants={riseIn}
                  style={{ '--hue': hex(palettes[palette][m.hue]) } as CSSProperties}
                >
                  <header>
                    <h3>{m.name}</h3>
                    <span className="muted">{mr.length} runs</span>
                  </header>
                  <div className="mode-stat-best">
                    <span className="eyebrow">Best</span>
                    <strong className="tnum">{best != null ? fmtInt(best) : '—'}</strong>
                    {tr != null && (
                      <span className={`trend ${tr >= 0 ? 'up' : 'down'}`}>
                        {tr >= 0 ? '▲' : '▼'} {Math.abs(Math.round(tr * 100))}%
                      </span>
                    )}
                  </div>
                  <Sparkline values={last.map((r) => r.score)} />
                  <dl className="mode-stat-meta">
                    <div>
                      <dt>Avg accuracy</dt>
                      <dd>{mr.length ? fmtPct(mean(last.map((r) => r.accuracy))) : '—'}</dd>
                    </div>
                    <div>
                      <dt>Consistency</dt>
                      <dd>{mr.length >= 3 ? fmtPct(consistency(last.map((r) => r.score))) : '—'}</dd>
                    </div>
                  </dl>
                </motion.article>
              );
            })}
          </motion.section>

          <motion.section className="recent" variants={riseIn}>
            <h2>Recent runs</h2>
            <table>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Score</th>
                  <th>Grade</th>
                  <th>Accuracy</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {modeMeta(r.mode).name}
                      {r.daily && <span className="chip chip-sm">daily</span>}
                    </td>
                    <td className="tnum">{fmtInt(r.score)}</td>
                    <td>
                      <span className={`grade-chip grade-${r.grade}`}>{r.grade}</span>
                    </td>
                    <td className="tnum">{fmtPct(r.accuracy)}</td>
                    <td className="muted">{fmtRelativeDay(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.section>

          <motion.div className="danger-zone" variants={riseIn}>
            {confirm ? (
              <>
                <span>Delete all {runs.length} runs? This can’t be undone.</span>
                <Button variant="danger" onClick={() => (clear(), setConfirm(false))}>
                  Yes, clear history
                </Button>
                <Button variant="subtle" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="subtle" onClick={() => setConfirm(true)}>
                Clear history…
              </Button>
            )}
          </motion.div>
        </motion.div>
      )}
    </motion.main>
  );
}
