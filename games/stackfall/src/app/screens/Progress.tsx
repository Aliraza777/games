import { motion } from 'motion/react';
import { useEffect } from 'react';
import { sfx } from '../../audio/sfx';
import { ACHIEVEMENTS } from '../../game/achievements';
import { MODES, type ModeId } from '../../game/modes';
import { THEMES } from '../../game/themes';
import { fmtScore, fmtTime } from '../../lib/format';
import { useApp } from '../../store/app';
import { dailyStreak, useProgress } from '../../store/progress';
import { PiecePreview } from '../components/PiecePreview';

const BOARD_MODES: ModeId[] = ['marathon', 'sprint', 'ultra', 'daily', 'zen'];

export function Progress() {
  const go = useApp((s) => s.go);
  const { boards, lifetime, achievements, daily, settings, updateSettings } = useProgress();
  const streak = dailyStreak(daily);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === 'Escape' && !useApp.getState().settingsOpen && go('title');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <motion.div className="screen progress" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
      <div className="title-bg" aria-hidden="true" />
      <div className="progress-scroll">
        <header className="progress-head">
          <button type="button" className="icon-btn" onClick={() => go('title')} aria-label="Back">
            ←
          </button>
          <h2>Progress</h2>
        </header>

        <section className="tiles">
          <Tile k="Lines cleared" v={fmtScore(lifetime.lines)} />
          <Tile k="Games" v={fmtScore(lifetime.games)} />
          <Tile k="Quads" v={fmtScore(lifetime.quads)} />
          <Tile k="T-spins" v={fmtScore(lifetime.tspins)} />
          <Tile k="All clears" v={fmtScore(lifetime.perfectClears)} />
          <Tile k="Daily streak" v={`🔥 ${streak}`} />
        </section>

        <section>
          <h3>Personal bests</h3>
          <div className="bests">
            {BOARD_MODES.map((m) => {
              const b = boards[m] ?? [];
              return (
                <div className="best-card" key={m}>
                  <span className="eyebrow">{MODES[m].name}</span>
                  {b.length === 0 ? (
                    <p className="muted">No record yet</p>
                  ) : (
                    <ol>
                      {b.map((e, i) => (
                        <li key={i}>
                          <span>{MODES[m].rank === 'time' ? fmtTime(e.timeMs) : fmtScore(e.score)}</span>
                          <span className="muted">{new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3>
            Achievements <span className="muted">{achievements.length}/{ACHIEVEMENTS.length}</span>
          </h3>
          <div className="achievements">
            {ACHIEVEMENTS.map((a) => {
              const got = achievements.includes(a.id);
              return (
                <div key={a.id} className={`ach ${got ? 'got' : ''}`}>
                  <span className="ach-icon" aria-hidden="true">{got ? '🏆' : '🔒'}</span>
                  <span>
                    <b>{a.name}</b>
                    <small>{a.hint}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3>Themes</h3>
          <div className="themes">
            {THEMES.map((t) => {
              const open = lifetime.lines >= t.unlock;
              const active = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-card ${active ? 'active' : ''}`}
                  disabled={!open}
                  onClick={() => {
                    sfx.ui();
                    updateSettings({ theme: t.id });
                  }}
                  style={{ background: `linear-gradient(${t.well[0]}, ${t.well[1]})`, ['--accent' as string]: t.accent }}
                  aria-pressed={active}
                >
                  <span className="theme-pieces">
                    <PiecePreview type="T" theme={t} />
                    <PiecePreview type="I" theme={t} />
                  </span>
                  <b>{t.name}</b>
                  {open ? (
                    <small>{active ? 'Selected' : 'Tap to use'}</small>
                  ) : (
                    <small>
                      <span className="meter"><span style={{ width: `${(lifetime.lines / t.unlock) * 100}%` }} /></span>
                      {fmtScore(t.unlock - lifetime.lines)} more lines
                    </small>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="tile">
      <strong>{v}</strong>
      <span className="eyebrow">{k}</span>
    </div>
  );
}
