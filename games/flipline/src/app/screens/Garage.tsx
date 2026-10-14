import { motion } from 'motion/react';
import { useEffect } from 'react';
import { sfx } from '../../audio/sfx';
import { SKINS } from '../../game/config';
import { TOTAL_GEMS } from '../../game/levels';
import { useApp } from '../../store/app';
import { totalGems, useProgress } from '../../store/progress';
import { BikeArt } from '../components/BikeArt';

export function Garage() {
  const levels = useProgress((s) => s.levels);
  const selected = useProgress((s) => s.skin);
  const setSkin = useProgress((s) => s.setSkin);
  const go = useApp((s) => s.go);
  const gems = totalGems(levels);
  // Fading out: don't take input meant for the next screen.
  const active = useApp((st) => st.screen) === 'garage';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === 'Escape' && useApp.getState().screen === 'garage' && go('title');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <motion.main className="screen page" inert={!active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <header className="page-head">
        <button type="button" className="back" onClick={() => go('title')}>
          ← Back
        </button>
        <h1>Garage</h1>
        <span className="gem-count">
          ◆ {gems} / {TOTAL_GEMS}
        </span>
      </header>
      <p className="page-note">Collect gems in the levels to unlock new bikes.</p>
      <div className="garage-grid" role="radiogroup" aria-label="Bikes">
        {SKINS.map((s) => {
          const unlocked = gems >= s.cost;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected === s.id}
              aria-disabled={!unlocked}
              className={`skin-card${selected === s.id ? ' is-active' : ''}${unlocked ? '' : ' is-locked'}`}
              onClick={() => {
                if (!unlocked) return;
                sfx.ensure();
                sfx.ui();
                setSkin(s.id);
              }}
              aria-label={`${s.name}${unlocked ? '' : ` — needs ${s.cost} gems`}`}
            >
              <BikeArt skin={s} locked={!unlocked} />
              <span className="skin-name">{s.name}</span>
              <span className="skin-cost">{unlocked ? (selected === s.id ? 'Riding' : 'Ride') : `◆ ${s.cost}`}</span>
            </button>
          );
        })}
      </div>
    </motion.main>
  );
}
