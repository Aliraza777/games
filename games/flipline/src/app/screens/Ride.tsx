import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/sfx';
import { SKINS } from '../../game/config';
import { Game, type RideEvent, type RideHud, type RideResult } from '../../game/Game';
import { LEVELS, levelById } from '../../game/levels';
import { useApp } from '../../store/app';
import { isTouchDevice, prefersReducedMotion, useProgress } from '../../store/progress';

interface Toast {
  id: number;
  text: string;
  kind: 'trick' | 'perfect' | 'hint' | 'gem';
}

interface Outcome {
  result: RideResult;
  firstClear: boolean;
  newBestTime: boolean;
}

const FLIP_NAMES = ['', 'Flip!', 'Double flip!', 'Triple flip!', 'Quad flip!'];
let toastId = 0;

export function RideScreen() {
  const ride = useApp((s) => s.ride)!;
  return <RideView key={ride.nonce} levelId={ride.levelId} />;
}

function RideView({ levelId }: { levelId: number }) {
  const def = levelById(levelId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const [hud, setHud] = useState<RideHud | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { play, go } = useApp.getState();
  const touch = isTouchDevice();

  const toast = (text: string, kind: Toast['kind'], ms = 1200) => {
    const id = ++toastId;
    setToasts((t) => [...t.filter((x) => kind !== 'hint' || x.kind !== 'hint').slice(-2), { id, text, kind }]);
    if (kind !== 'hint') setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const p = useProgress.getState();
    const skin = SKINS.find((s) => s.id === p.skin) ?? SKINS[0];
    sfx.ensure();
    sfx.setVolumes(p.settings.sound, p.settings.music ? 0.5 : 0);
    let musicStarted = false;
    const g = new Game(el, {
      level: def,
      skin,
      reducedMotion: prefersReducedMotion(p.settings.reducedMotion),
      tutorial: def.id === 1 && !p.tutorialDone,
      onHud: (h) => {
        setHud(h);
        if (h.state === 'riding' && !musicStarted && p.settings.music) {
          musicStarted = true;
          sfx.startMusic();
        }
      },
      onEvent: (e: RideEvent) => {
        if (e.type === 'landing' && e.landing.flips > 0) {
          toast(FLIP_NAMES[Math.min(4, e.landing.flips)] || `${e.landing.flips}× flip!`, 'trick');
          if (e.landing.quality === 'perfect') toast('Perfect landing', 'perfect');
        }
        if (e.type === 'hint') toast(e.text, 'hint');
        if (e.type === 'hint-done') setToasts((t) => t.filter((x) => x.kind !== 'hint'));
        if (e.type === 'finish') {
          sfx.stopMusic();
          const r = useProgress.getState().complete(e.result);
          if (def.id === 1) useProgress.getState().setTutorialDone();
          setToasts([]);
          setOutcome({ result: e.result, ...r });
        }
      },
    });
    game.current = g;
    // Test hook: dev server, or a production build made for e2e (VITE_E2E=1) — never the deployed build.
    if (import.meta.env.DEV || import.meta.env.VITE_E2E) (window as unknown as { __flipline?: Game }).__flipline = g;
    g.start();
    return () => {
      g.destroy();
      sfx.stopMusic();
      game.current = null;
    };
  }, [def]);

  const pause = () => {
    const g = game.current;
    if (!g || outcome) return;
    g.pause();
    sfx.stopMusic();
    setPaused(true);
  };
  const resume = () => {
    game.current?.resume();
    setPaused(false);
    if (useProgress.getState().settings.music) sfx.startMusic();
  };
  const restart = () => play(levelId);
  const next = LEVELS.find((l) => l.id === levelId + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if ((e.code === 'Enter' || e.code === 'Space') && (e.target as HTMLElement)?.closest?.('button')) return;
      if (outcome) {
        if (e.code === 'Enter' || e.code === 'Space') next ? play(next.id) : go('levels');
        if (e.code === 'KeyR') restart();
        if (e.code === 'Escape') go('levels');
        return;
      }
      if (e.code === 'Escape') (paused ? resume : pause)();
      if (e.code === 'KeyR') restart();
    };
    const onBlur = () => game.current?.state === 'riding' && pause();
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
    };
  });

  return (
    <main className="screen ride" style={{ '--c': def.color } as CSSProperties}>
      <canvas ref={canvas} className="ride-canvas" data-testid="ride" />

      <header className="hud" aria-hidden={!!outcome}>
        <button type="button" className="icon-btn" aria-label="Pause" onClick={pause} onPointerDown={(e) => e.stopPropagation()}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
        <div className="hud-center">
          <span className="hud-level">
            {def.id}. {def.name}
          </span>
          <div className="progress" role="progressbar" aria-label="Level progress" aria-valuenow={Math.round((hud?.progress ?? 0) * 100)}>
            <div style={{ transform: `scaleX(${hud?.progress ?? 0})` }} />
          </div>
        </div>
        <div className="hud-stats">
          <span data-testid="flips">↺ {hud?.flips ?? 0}</span>
          <span data-testid="gems">
            ◆ {hud?.gems ?? 0}/{hud?.gemTotal ?? 3}
          </span>
        </div>
      </header>

      {hud?.state === 'ready' && !paused && !outcome && (
        <motion.p className="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {touch ? 'Hold anywhere to ride' : 'Hold the mouse or any key to ride'}
        </motion.p>
      )}
      {hud?.state === 'crashed' && (
        <motion.p className="prompt crash" initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: hud.canRetry ? 1 : 0.4, scale: 1 }} data-testid="retry">
          {hud.canRetry ? (touch ? 'Tap to retry' : 'Click or press any key to retry') : 'Ouch!'}
        </motion.p>
      )}

      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast toast-${t.kind}`}
              initial={{ opacity: 0, y: 10, scale: t.kind === 'hint' ? 0.95 : 1.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {paused && !outcome && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="panel" role="dialog" aria-modal="true" aria-label="Paused">
              <h2>Paused</h2>
              <p className="muted">{touch ? 'Hold to ride · hold in the air to flip' : 'Hold mouse / any key to ride · hold in the air to flip'}</p>
              <div className="panel-actions">
                <button type="button" className="btn primary" onClick={resume} autoFocus>
                  Resume
                </button>
                <button type="button" className="btn" onClick={restart}>
                  Restart level
                </button>
                <button type="button" className="btn ghost" onClick={() => go('levels')}>
                  Levels
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {outcome && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div
              className="panel finish"
              role="dialog"
              aria-modal="true"
              aria-label="Level complete"
              data-testid="finish"
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <span className="eyebrow">Level {def.id}</span>
              <h2>{def.name} complete!</h2>
              <div className="finish-gems" aria-label={`${outcome.result.gems.length} of 3 gems`}>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className={outcome.result.gems.includes(i) ? 'on' : ''}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 500, damping: 14 }}
                  >
                    ◆
                  </motion.span>
                ))}
              </div>
              <dl className="finish-stats">
                <div>
                  <dt>Time</dt>
                  <dd>
                    {outcome.result.time.toFixed(2)}s{outcome.newBestTime && <b className="best"> best!</b>}
                  </dd>
                </div>
                <div>
                  <dt>Flips</dt>
                  <dd>{outcome.result.flips}</dd>
                </div>
                <div>
                  <dt>Perfect</dt>
                  <dd>{outcome.result.perfects}</dd>
                </div>
                <div>
                  <dt>Crashes</dt>
                  <dd>{outcome.result.crashes}</dd>
                </div>
              </dl>
              <div className="panel-actions">
                {next ? (
                  <button type="button" className="btn primary" onClick={() => play(next.id)} autoFocus>
                    Next level
                  </button>
                ) : (
                  <button type="button" className="btn primary" onClick={() => go('levels')} autoFocus>
                    All levels done!
                  </button>
                )}
                <button type="button" className="btn" onClick={restart}>
                  Ride again
                </button>
                <button type="button" className="btn ghost" onClick={() => go('levels')}>
                  Levels
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
