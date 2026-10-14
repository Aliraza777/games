import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { SKINS } from '../../game/config';
import { Game } from '../../game/Game';
import { LEVELS, TOTAL_GEMS } from '../../game/levels';
import { useApp } from '../../store/app';
import { isTouchDevice, nextLevel, prefersReducedMotion, totalGems, useProgress } from '../../store/progress';

/** The real game riding itself (with the odd backflip) behind the menu. */
function Showcase() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const skinId = useProgress((s) => s.skin);
  const rm = prefersReducedMotion(useProgress((s) => s.settings.reducedMotion));
  useEffect(() => {
    if (!canvas.current) return;
    const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0];
    const g = new Game(canvas.current, { level: LEVELS[3], skin, attract: true, reducedMotion: rm });
    g.start();
    return () => g.destroy();
  }, [skinId, rm]);
  return <canvas ref={canvas} className="showcase" aria-hidden />;
}

export function Title() {
  const levels = useProgress((s) => s.levels);
  const settings = useProgress((s) => s.settings);
  const update = useProgress((s) => s.updateSettings);
  const { go, play } = useApp.getState();
  const [pressing, setPressing] = useState(false);
  const target = nextLevel(levels);
  const gems = totalGems(levels);
  const done = Object.values(levels).filter((l) => l.done).length;
  const touch = isTouchDevice();

  // While fading out, this screen must not take input meant for the next one.
  const active = useApp((s) => s.screen) === 'title';

  const start = () => {
    if (useApp.getState().screen !== 'title') return;
    sfx.ensure();
    sfx.ui();
    play(target);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useApp.getState().screen !== 'title') return;
      if (e.repeat || (e.target as HTMLElement)?.closest?.('button')) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <motion.main className={`screen title${active ? '' : ' is-leaving'}`} inert={!active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <Showcase />
      <div className="title-ui">
        <motion.h1 className="wordmark" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          FLIP<span>LINE</span>
        </motion.h1>
        <p className="tagline">Hold to ride. Hold to flip. Land clean.</p>

        <motion.button
          type="button"
          className={`play${pressing ? ' is-pressing' : ''}`}
          // The press itself starts the ride, so holding carries straight into riding.
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            setPressing(true);
            start();
          }}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          // Keyboard / assistive-tech activation (no pointer involved).
          onClick={(e) => e.detail === 0 && start()}
          whileTap={{ scale: 0.95 }}
          aria-label={`Play level ${target}`}
        >
          <span className="play-ring" aria-hidden />
          <span className="play-label">{touch ? 'Tap to play' : 'Click or press Space to play'}</span>
          <span className="play-level">
            Level {target} · {LEVELS[target - 1].name}
          </span>
        </motion.button>

        <nav className="title-nav" aria-label="Menu">
          <button type="button" onClick={() => go('levels')}>
            Levels <small>{done}/12</small>
          </button>
          <button type="button" onClick={() => go('garage')}>
            Garage{' '}
            <small>
              ◆ {gems}/{TOTAL_GEMS}
            </small>
          </button>
          <button type="button" aria-pressed={settings.sound > 0} onClick={() => update({ sound: settings.sound > 0 ? 0 : 0.8 })}>
            Sound {settings.sound > 0 ? 'on' : 'off'}
          </button>
          <button type="button" aria-pressed={settings.music} onClick={() => update({ music: !settings.music })}>
            Music {settings.music ? 'on' : 'off'}
          </button>
        </nav>
        <p className="credit">
          A one-button stunt game inspired by the classic neon bike genre. More games:{' '}
          <a href="https://inkway.vercel.app">Inkway</a> · <a href="https://pulse-aim-trainer.vercel.app">Pulse</a> ·{' '}
          <a href="https://drift-calm.vercel.app">Drift</a>
        </p>
      </div>
    </motion.main>
  );
}
