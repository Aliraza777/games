import { motion } from 'motion/react';
import { useState } from 'react';
import { PRACTICES, practice } from '../../breath/practices';
import { useApp } from '../../store/app';
import { useHistory } from '../../store/history';
import { averageTensionDrop, recentDays, streak, totalMinutes } from '../../store/stats';
import { Button } from '../components/Button';
import { IconBack } from '../components/Icons';
import { fmtClock, useKeys } from '../hooks';

export function Journey() {
  const sessions = useHistory((s) => s.sessions);
  const clear = useHistory((s) => s.clear);
  const go = useApp((s) => s.go);
  const [confirm, setConfirm] = useState(false);
  useKeys({ Escape: () => go('home') });

  const days = recentDays(sessions, 28);
  const maxMin = Math.max(5, ...days.map((d) => d.minutes));
  const drop = averageTensionDrop(sessions);

  return (
    <motion.main className="screen page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <header className="page-head">
        <Button variant="ghost" icon={<IconBack />} onClick={() => go('home')} hint="Esc">
          Back
        </Button>
        <h1>Your journey</h1>
      </header>

      {sessions.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 120 60" className="empty-art" aria-hidden>
            <path d="M4 50 Q 30 20 60 34 T 116 14" />
          </svg>
          <h2>Your path starts with one breath.</h2>
          <p className="muted">Finish a practice and it will appear here.</p>
          <Button variant="primary" onClick={() => go('home')}>
            Choose a practice
          </Button>
        </div>
      ) : (
        <div className="journey">
          <section className="tiles">
            <div className="tile">
              <span className="tile-label">Days in a row</span>
              <span className="tile-value">{streak(sessions)}</span>
            </div>
            <div className="tile">
              <span className="tile-label">Minutes practised</span>
              <span className="tile-value">{Math.round(totalMinutes(sessions))}</span>
            </div>
            <div className="tile">
              <span className="tile-label">Sessions</span>
              <span className="tile-value">{sessions.length}</span>
            </div>
            <div className="tile">
              <span className="tile-label">Avg tension change</span>
              <span className="tile-value">{drop == null ? '—' : `${drop > 0 ? '−' : drop < 0 ? '+' : ''}${Math.abs(drop).toFixed(1)}`}</span>
            </div>
          </section>

          <section className="garden" aria-label="Last 28 days">
            <h2>Last four weeks</h2>
            <div className="garden-grid">
              {days.map((d) => (
                <span
                  key={d.key}
                  className={`garden-day${d.minutes > 0 ? ' is-on' : ''}`}
                  title={`${d.key}: ${Math.round(d.minutes)} min`}
                  style={{ ['--s' as string]: d.minutes > 0 ? 0.45 + 0.55 * Math.min(1, d.minutes / maxMin) : 0.2 }}
                />
              ))}
            </div>
          </section>

          <section className="by-practice">
            {PRACTICES.map((p) => {
              const n = sessions.filter((s) => s.practice === p.id).length;
              return (
                <span key={p.id} className="chip">
                  {p.name} · {n}
                </span>
              );
            })}
          </section>

          <section className="recent">
            <h2>Recent</h2>
            <ul>
              {sessions
                .slice(-10)
                .reverse()
                .map((s) => (
                  <li key={s.id}>
                    <span>{practice(s.practice).name}</span>
                    <span className="muted tnum">{fmtClock(s.seconds)}</span>
                    <span className="muted">
                      {s.tensionBefore != null && s.tensionAfter != null ? `tension ${s.tensionBefore} → ${s.tensionAfter}` : ''}
                    </span>
                    <span className="muted">{new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </li>
                ))}
            </ul>
          </section>

          <div className="danger">
            {confirm ? (
              <>
                <span className="muted">Erase all {sessions.length} sessions?</span>
                <Button variant="danger" size="sm" onClick={() => (clear(), setConfirm(false))}>
                  Erase
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
                Clear journey…
              </Button>
            )}
          </div>
        </div>
      )}
    </motion.main>
  );
}
