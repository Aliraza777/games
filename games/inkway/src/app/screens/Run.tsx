import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sfx } from '../../audio/sfx';
import { FOCUS, INKS, INK_ORDER, VEHICLES } from '../../game/config';
import { Game, type GameEvent, type HudState, type RunResult } from '../../game/Game';
import { useApp, type RunConfig } from '../../store/app';
import { useRecords } from '../../store/records';
import { prefersReducedMotion, useSettings } from '../../store/settings';
import { Button } from '../components/Button';

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
    const doPause = () => {
      const g = game.current;
      if (!g || g.state === 'over' || g.state === 'crashing' || g.state === 'paused') return;
      g.pause();
      sfx.stopMusic();
      setPaused(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g || e.repeat) return;
      const k = e.key.toLowerCase();
      if (g.state === 'over') {
        if (k === 'enter' || k === 'r') restart();
        if (k === 'escape') toTitle();
        return;
      }
      if (k === 'escape') {
        if (g.state === 'paused') resume();
        else doPause();
      }
      if (k === 'r') restart();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', doPause);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', doPause);
    };
  }, [restart, toTitle]);

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
              <div className={`focus${hud.focusActive ? ' is-active' : ''}`} aria-label="Focus (Shift)">
                <span>Shift · slow time</span>
                <div className="focus-bar">
                  <div style={{ transform: `scaleX(${hud.focus / FOCUS.max})` }} />
                </div>
              </div>
            </div>
          </div>
          {hud.state === 'ready' && !outcome && (
            <motion.div className="ready-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Hold <kbd>W</kbd> to roll
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
