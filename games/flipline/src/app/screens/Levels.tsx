import { motion } from 'motion/react';
import { useEffect, type CSSProperties } from 'react';
import { sfx } from '../../audio/sfx';
import { LEVELS } from '../../game/levels';
import { useApp } from '../../store/app';
import { isUnlocked, useProgress } from '../../store/progress';

export function Levels() {
  const levels = useProgress((s) => s.levels);
  const { go, play } = useApp.getState();
  // Fading out: don't take input meant for the next screen.
  const active = useApp((st) => st.screen) === 'levels';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === 'Escape' && useApp.getState().screen === 'levels' && go('title');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <motion.main className="screen page" inert={!active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <header className="page-head">
        <button type="button" className="back" onClick={() => go('title')}>
          ← Back
        </button>
        <h1>Levels</h1>
      </header>
      <ol className="level-grid">
        {LEVELS.map((l, i) => {
          const p = levels[l.id];
          const open = isUnlocked(levels, l.id);
          return (
            <motion.li key={l.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
              <button
                type="button"
                className={`level-tile${p?.done ? ' is-done' : ''}`}
                style={{ '--c': l.color } as CSSProperties}
                disabled={!open}
                onClick={() => {
                  sfx.ensure();
                  sfx.ui();
                  play(l.id);
                }}
                aria-label={`Level ${l.id}: ${l.name}${open ? '' : ' (locked)'}${p?.done ? `, done, ${p.gems.length} of 3 gems` : ''}`}
              >
                <span className="lt-num">{open ? l.id : '🔒'}</span>
                <span className="lt-name">{l.name}</span>
                <span className="lt-gems" aria-hidden>
                  {[0, 1, 2].map((g) => (
                    <i key={g} className={p?.gems.includes(g) ? 'on' : ''}>
                      ◆
                    </i>
                  ))}
                </span>
                {p?.bestTime != null && <span className="lt-best">{p.bestTime.toFixed(1)}s</span>}
              </button>
            </motion.li>
          );
        })}
      </ol>
    </motion.main>
  );
}
