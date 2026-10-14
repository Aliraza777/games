import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/sfx';
import { FOCUS, INKS, INK_ORDER, VEHICLES } from '../../game/config';
import { Game, type GameEvent, type HudState, type RunResult } from '../../game/Game';
import { useApp, type RunConfig } from '../../store/app';
import { useRecords } from '../../store/records';
import { prefersReducedMotion, useSettings } from '../../store/settings';
import { isTouchDevice, usePortrait } from '../../lib/device';
import { Button } from '../components/Button';
import { ControlsCard } from '../components/Controls';
import { TouchControls, TouchLegend } from '../components/TouchControls';

interface Toast {
  id: number;
  kind: 'hint' | 'trick' | 'pickup';
  text: string;
  sub?: string;
  hintId?: string;
}

interface Outcome {
  result: RunResult;
  newBest: boolean;
  previousBest: number | null;
}

export function RunScreen() {
  const run = useApp((s) => s.run)!;
  return <RunView key={run.nonce} run={run} />;
}

let toastId = 0;

function RunView({ run }: { run: RunConfig }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { restart, toTitle } = useApp.getState();
  const spec = VEHICLES[run.vehicle];
  const touch = isTouchDevice();
  const portrait = usePortrait();
  const [portraitOk, setPortraitOk] = useState(false);
  const [, setReady] = useState(false);

  const push = (t: Omit<Toast, 'id'>, ms: number) => {
    const id = ++toastId;
    setToasts((all) => [...all.filter((x) => !(t.hintId && x.hintId === t.hintId)).slice(-3), { ...t, id }]);
    window.setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), ms);
  };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const settings = useSettings.getState();
    sfx.ensure();
    sfx.setVolumes({ sfx: settings.sfx, music: settings.music });
    const g = new Game(el, {
      vehicle: run.vehicle,
      seed: run.seed,
      daily: run.daily,
      reducedMotion: prefersReducedMotion(settings.reducedMotion),
      shake: settings.shake,
      tutorial: !settings.tutorialDone,
      touch,
      onHud: setHud,
      onEvent: (e: GameEvent) => {
        if (e.type === 'hint') push({ kind: 'hint', text: e.text, hintId: e.id }, e.id === 'draw' ? 15000 : 6500);
        if (e.type === 'hint-done') {
          setToasts((all) => all.filter((x) => x.hintId !== e.id));
          if (e.id === 'draw') useSettings.getState().update({ tutorialDone: true });
        }
        if (e.type === 'trick') {
          push({ kind: 'trick', text: e.landing.label, sub: `+${e.landing.points}${e.landing.ink ? ` · +${e.landing.ink} ink` : ''}${e.landing.combo > 1 ? ` · ×${e.landing.combo}` : ''}` }, 1600);
        }
        if (e.type === 'started' && settings.musicOn) sfx.startMusic();
      },
      onOver: (result) => {
        sfx.stopMusic();
        const r = useRecords.getState().add(result);
        setOutcome({ result, newBest: r.newBest, previousBest: r.previous?.score ?? null });
      },
    });
    game.current = g;
    setReady(true); // re-render so touch controls can bind to the game
    if (import.meta.env.DEV) (window as unknown as { __inkway?: Game }).__inkway = g;
    g.start();
    return () => {
      g.destroy();
      sfx.stopMusic();
      game.current = null;
    };
  }, [run]);

  // Pause on Esc or when the window loses focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g || e.repeat) return;
      // A focused button handles Enter/Space itself — don't fire twice (QA I8).
      if ((e.code === 'Enter' || e.code === 'Space') && (e.target as HTMLElement)?.closest?.('button')) return;
      if (g.state === 'over') {
        if (e.code === 'Enter' || e.code === 'KeyR') restart();
        if (e.code === 'Escape') toTitle();
        return;
      }
      if (e.code === 'Escape') {
        if (g.state === 'paused') resume();
        else doPause();
      }
      if (e.code === 'KeyR') restart();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', doPause);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', doPause);
    };
  }, [restart, toTitle]);

  function doPause() {
    const g = game.current;
    if (!g || g.state === 'over' || g.state === 'crashing' || g.state === 'paused') return;
    g.pause();
    sfx.stopMusic();
    setPaused(true);
  }

  const resume = () => {
    const g = game.current;
    if (!g) return;
    g.resume();
    setPaused(false);
    if (useSettings.getState().musicOn && g.state === 'running') sfx.startMusic();
  };

  const ink = hud ? hud.ink / 100 : 1;
  const inkColor = INKS[hud?.inkKind ?? 'road'].color;

  return (
    <main className="screen run" style={{ ['--v' as string]: spec.color } as CSSProperties}>
      <canvas ref={canvas} className="game-canvas" data-testid="game" />
      {!outcome && !paused && (
        <button type="button" className="pause-btn" aria-label="Pause" onClick={doPause} onPointerDown={(e) => e.stopPropagation()}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      )}
      {touch && !outcome && !paused && game.current && <TouchControls api={game.current} />}
      {touch && portrait && !portraitOk && !outcome && (
        <div className="rotate-prompt" role="dialog" aria-label="Rotate your phone">
          <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
            <rect x="20" y="8" width="24" height="44" rx="5" className="rp-phone" />
            <path d="M8 40 a24 24 0 0 0 24 18" className="rp-arrow" />
            <path d="M28 54 l4 4 -5 3" className="rp-arrow" />
          </svg>
          <p>Turn your phone sideways — your left thumb drives, your right finger draws.</p>
          <Button onClick={() => setPortraitOk(true)}>Play anyway</Button>
        </div>
      )}

      {hud && (
        <div className="hud" aria-hidden={!!outcome}>
          <div className="hud-tl">
            <div className="hud-distance tnum" data-testid="distance">
              {hud.distance}
              <small>m</small>
            </div>
            <div className="hud-score tnum">{hud.score.toLocaleString()} pts</div>
          </div>
          <div className="hud-tr">
            <span className="hud-stars tnum">★ {hud.stars}</span>
            {hud.combo > 1 && <span className="hud-combo">combo ×{hud.combo}</span>}
            <span className="hud-speed tnum">{hud.speedKmh} km/h</span>
          </div>
          <div className="hud-bl">
            <div className="tank" aria-label={`Ink ${Math.round(hud.ink)} of 100`} style={{ ['--ink' as string]: inkColor } as CSSProperties}>
              <div className="tank-fill" style={{ transform: `scaleY(${ink})` }} />
              <span className="tank-value tnum">{Math.round(hud.ink)}</span>
            </div>
            <div className="inks" role="radiogroup" aria-label="Ink">
              {INK_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={hud.inkKind === k}
                  className={`ink-chip${hud.inkKind === k ? ' is-active' : ''}`}
                  style={{ ['--ink' as string]: INKS[k].color } as CSSProperties}
                  onClick={() => game.current?.setInk(k)}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`ink-${k}`}
                >
                  <kbd>{INKS[k].key}</kbd>
                  <span>{INKS[k].label}</span>
                </button>
              ))}
              <div className={`focus${hud.focusActive ? ' is-active' : ''}`} aria-label="Focus (slow time)">
                <span>{touch ? 'Slow time' : 'Shift · slow time'}</span>
                <div className="focus-bar">
                  <div style={{ transform: `scaleX(${hud.focus / FOCUS.max})` }} />
                </div>
              </div>
            </div>
          </div>
          {hud.state === 'ready' && !outcome && (
            <motion.div className="ready-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {touch ? (
                'Push the stick → to roll'
              ) : (
                <>
                  Hold <kbd>W</kbd> to roll
                </>
              )}
            </motion.div>
          )}
        </div>
      )}

      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              className={`toast toast-${t.kind}`}
              initial={{ opacity: 0, y: 14, scale: t.kind === 'trick' ? 1.4 : 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            >
              <span>{t.text}</span>
              {t.sub && <small>{t.sub}</small>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {paused && !outcome && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="panel" role="dialog" aria-modal="true" aria-label="Paused" initial={{ scale: 0.94 }} animate={{ scale: 1 }}>
              <h2>Paused</h2>
              <div className="pause-help">{touch ? <TouchLegend /> : <ControlsCard />}</div>
              <div className="panel-actions">
                <Button variant="primary" kbd="Esc" onClick={resume} autoFocus>
                  Resume
                </Button>
                <Button kbd="R" onClick={restart}>
                  Restart
                </Button>
                <Button variant="ghost" onClick={toTitle}>
                  Garage
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {outcome && <GameOver outcome={outcome} onRetry={restart} onTitle={toTitle} />}
      </AnimatePresence>
    </main>
  );
}

function GameOver({ outcome, onRetry, onTitle }: { outcome: Outcome; onRetry: () => void; onTitle: () => void }) {
  const r = outcome.result;
  return (
    <motion.div className="overlay over" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label="Run over"
        data-testid="game-over"
        initial={{ y: 40, rotate: -2, opacity: 0 }}
        animate={{ y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
      >
        <span className="eyebrow">{r.daily ? 'Daily ride' : VEHICLES[r.vehicle].name}</span>
        <h2>{r.cause === 'void' ? 'Swallowed by the void' : 'Wrecked!'}</h2>
        {outcome.newBest && (
          <motion.div className="best-stamp" initial={{ scale: 2, rotate: 12, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.5 }}>
            New best!
          </motion.div>
        )}
        <dl className="over-stats">
          <div>
            <dt>Score</dt>
            <dd className="tnum" data-testid="final-score">
              {r.score.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd className="tnum">{r.distance} m</dd>
          </div>
          <div>
            <dt>Stars</dt>
            <dd className="tnum">★ {r.stars}</dd>
          </div>
          <div>
            <dt>Flips</dt>
            <dd className="tnum">{r.flips}</dd>
          </div>
          <div>
            <dt>Ink drawn</dt>
            <dd className="tnum">{r.inkDrawn} m</dd>
          </div>
          <div>
            <dt>Best trick</dt>
            <dd>{r.bestTrick ?? '—'}</dd>
          </div>
        </dl>
        {!outcome.newBest && outcome.previousBest != null && <p className="muted">Personal best: {outcome.previousBest.toLocaleString()}</p>}
        <div className="panel-actions">
          <Button variant="primary" size="lg" kbd="R" onClick={onRetry} autoFocus>
            Ride again
          </Button>
          <Button kbd="Esc" onClick={onTitle}>
            Garage
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
