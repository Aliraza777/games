import { motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { ACHIEVEMENTS } from '../../game/achievements';
import type { RunResult } from '../../game/engine';
import type { ModeDef } from '../../game/modes';
import { THEMES } from '../../game/themes';
import { fmtScore, fmtTime } from '../../lib/format';
import type { RecordOutcome } from '../../store/progress';

function headline(mode: ModeDef, r: RunResult) {
  if (r.reason === 'goal') return mode.id === 'sprint' ? 'Finished!' : 'Marathon complete!';
  if (r.reason === 'time') return "Time's up!";
  if (r.reason === 'quit') return 'Session complete';
  return 'Game over';
}

/** The line that makes you press Play again. */
function verdict(mode: ModeDef, r: RunResult, rec: RecordOutcome): { text: string; tone: 'best' | 'good' | 'near' | 'plain' } {
  const prev = rec.previousBest;
  if (rec.newBest) {
    if (mode.rank === 'time') return { text: `NEW BEST · ${((prev!.timeMs - r.timeMs) / 1000).toFixed(2)}s faster`, tone: 'best' };
    return { text: `NEW BEST · +${fmtScore(r.score - prev!.score)}`, tone: 'best' };
  }
  if (rec.rank === 0) return { text: 'FIRST RECORD SET', tone: 'best' };
  if (mode.rank === 'time' && !r.completed) {
    const left = (mode.lineGoal ?? 0) - r.lines;
    return { text: `${left} line${left === 1 ? '' : 's'} to go. So close!`, tone: 'near' };
  }
  if (rec.rank > 0) return { text: `#${rec.rank + 1} on your board`, tone: 'good' };
  if (prev && mode.rank === 'score' && r.score > 0) {
    const gap = prev.score - r.score;
    const pct = gap / Math.max(1, prev.score);
    return { text: `${fmtScore(gap)} from your best${pct < 0.15 ? '. Almost!' : ''}`, tone: pct < 0.15 ? 'near' : 'plain' };
  }
  if (prev && mode.rank === 'time') return { text: `${((r.timeMs - prev.timeMs) / 1000).toFixed(2)}s off your best`, tone: 'near' };
  return { text: 'Keep stacking', tone: 'plain' };
}

const COLORS = ['#2fe6ff', '#ff4f6e', '#ffd23f', '#3ce283', '#b866ff', '#ff9a2e', '#3f6dff'];

function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ x: Math.random() * 100, d: Math.random() * 0.6, r: Math.random() * 720 - 360, c: COLORS[i % COLORS.length], s: 6 + Math.random() * 8, dur: 1.6 + Math.random() * 1.4 })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <motion.i
          key={i}
          style={{ left: `${b.x}%`, background: b.c, width: b.s, height: b.s * 0.45 }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: b.r, opacity: [1, 1, 0] }}
          transition={{ duration: b.dur, delay: b.d, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

export function Results({ mode, result: r, rec, reduced, onAgain, onMenu }: { mode: ModeDef; result: RunResult; rec: RecordOutcome; reduced: boolean; onAgain: () => void; onMenu: () => void }) {
  const v = verdict(mode, r, rec);
  const opened = useRef(performance.now());
  const againRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    againRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // A short guard so a held hard-drop key can't skip the results.
      if (performance.now() - opened.current < 700) return;
      if (e.code === 'Enter' || e.code === 'KeyR' || e.code === 'NumpadEnter') {
        e.preventDefault();
        onAgain();
      } else if (e.code === 'Escape') onMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAgain, onMenu]);

  const main = mode.rank === 'time' ? (r.completed ? fmtTime(r.timeMs) : `${r.lines}/${mode.lineGoal}`) : fmtScore(r.score);
  const achievements = ACHIEVEMENTS.filter((a) => rec.achievements.includes(a.id));
  const themes = THEMES.filter((t) => rec.themes.includes(t.id));

  return (
    <motion.div className="overlay results-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {v.tone === 'best' && !reduced && <Confetti />}
      <motion.div className="card results" role="dialog" aria-label="Results" initial={{ y: 30, scale: 0.96 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
        <span className="eyebrow">{mode.name}{mode.id === 'daily' && rec.dailyStreak > 0 ? ` · 🔥 ${rec.dailyStreak} day streak` : ''}</span>
        <h2>{headline(mode, r)}</h2>
        <motion.div className="result-main" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }} data-testid="result-main">
          {main}
        </motion.div>
        <motion.div className={`verdict ${v.tone}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          {v.text}
        </motion.div>

        <div className="result-stats">
          {mode.rank === 'time' ? <Stat k="Score" v={fmtScore(r.score)} /> : <Stat k="Time" v={fmtTime(r.timeMs, false)} />}
          <Stat k="Lines" v={r.lines} />
          <Stat k="Level" v={r.level} />
          <Stat k="Pieces/s" v={r.pps.toFixed(2)} />
          <Stat k="Quads" v={r.quads} />
          <Stat k="T-spins" v={r.tspins} />
          <Stat k="Best combo" v={r.maxCombo} />
          <Stat k="All clears" v={r.perfectClears} />
        </div>

        {(achievements.length > 0 || themes.length > 0) && (
          <motion.div className="unlocks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            {achievements.map((a) => (
              <span key={a.id} className="unlock">🏆 {a.name}</span>
            ))}
            {themes.map((t) => (
              <span key={t.id} className="unlock theme">🎨 New theme: {t.name}</span>
            ))}
          </motion.div>
        )}

        {rec.board.length > 0 && (
          <ol className="board">
            {rec.board.map((b, i) => (
              <li key={b.date + '-' + i} className={i === rec.rank ? 'me' : ''}>
                <span className="rank">{i + 1}</span>
                <span className="val">{mode.rank === 'time' ? fmtTime(b.timeMs) : fmtScore(b.score)}</span>
                <span className="muted">{mode.rank === 'time' ? `${fmtScore(b.score)} pts` : `${b.lines} lines`}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="btn-row results-actions">
          <button type="button" ref={againRef} className="btn primary big" onClick={onAgain}>
            Play again <kbd>Enter</kbd>
          </button>
          <button type="button" className="btn" onClick={onMenu}>
            Menu
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rs">
      <span className="eyebrow">{k}</span>
      <strong>{v}</strong>
    </div>
  );
}
