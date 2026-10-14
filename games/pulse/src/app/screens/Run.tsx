import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { audio } from '../../audio/AudioManager';
import type { Engine } from '../../game/engine/Engine';
import { modeMeta } from '../../game/modes/meta';
import { useApp } from '../../store/app';
import { prefersReducedMotion, useSettings } from '../../store/settings';
import { hex, palettes } from '../../theme/palettes';
import { spring } from '../../theme/motion';
import { Button, Kbd } from '../components/Button';
import { Hud, type HudHandle } from '../components/Hud';
import { ModePreview } from '../components/ModePreview';
import { isTouchDevice, useHotkeys } from '../hooks';

type Phase = 'loading' | 'intro' | 'countdown' | 'running' | 'paused';

const COUNT_STEP = 520;

export function RunScreen() {
  const run = useApp((s) => s.run)!;
  const meta = modeMeta(run.mode);
  const palette = useSettings((s) => s.palette);
  const pointerLock = useSettings((s) => s.pointerLock);
  const rm = prefersReducedMotion(useSettings((s) => s.reducedMotion));
  const touch = isTouchDevice();

  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const hud = useRef<HudHandle>(null);
  const phaseRef = useRef<Phase>('loading');
  const token = useRef(0);
  const [phase, setPhaseState] = useState<Phase>('loading');
  const [count, setCount] = useState<number | null>(null);
  const [started, setStarted] = useState(false);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  // Engine (and PixiJS) are lazy-loaded so menus stay light.
  useEffect(() => {
    let cancelled = false;
    const settings = useSettings.getState();
    void import('../../game/engine/Engine').then(async ({ Engine }) => {
      if (cancelled || !host.current) return;
      const e = new Engine(host.current, {
        mode: run.mode,
        seed: run.seed,
        daily: run.daily,
        settings,
        reducedMotion: prefersReducedMotion(settings.reducedMotion),
        callbacks: {
          onHud: (s) => hud.current?.update(s),
          onTierUp: (t) => hud.current?.tierUp(t),
          onFocusLost: () => pause(),
          onEnd: (r) => useApp.getState().finishRun(r),
        },
      });
      engine.current = e;
      if (import.meta.env.DEV) (window as unknown as { __pulseEngine?: Engine }).__pulseEngine = e;
      await e.init();
      if (!cancelled) setPhase('intro');
    });
    return () => {
      cancelled = true;
      token.current++;
      engine.current?.destroy();
      engine.current = null;
    };
  }, []);

  const countdown = (done: () => void) => {
    const my = ++token.current;
    let n = 3;
    setCount(n);
    audio.countdown(false);
    const tick = () => {
      if (my !== token.current) return;
      n--;
      if (n > 0) {
        setCount(n);
        audio.countdown(false);
        setTimeout(tick, COUNT_STEP);
      } else {
        setCount(0);
        audio.countdown(true);
        done();
        setTimeout(() => my === token.current && setCount(null), 420);
      }
    };
    setTimeout(tick, COUNT_STEP);
  };

  const begin = () => {
    const e = engine.current;
    const p = phaseRef.current;
    if (!e || (p !== 'intro' && p !== 'paused')) return;
    audio.ensure();
    void e.lockPointer(); // called synchronously inside the gesture
    setPhase('countdown');
    countdown(() => {
      if (e.state === 'idle') e.start();
      else e.resume();
      setStarted(true);
      setPhase('running');
    });
  };

  function pause() {
    const e = engine.current;
    if (phaseRef.current === 'countdown') {
      token.current++;
      setCount(null);
      setPhase(e?.state === 'idle' ? 'intro' : 'paused');
      return;
    }
    if (!e || phaseRef.current !== 'running') return;
    e.pause();
    setPhase('paused');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  const quit = () => {
    engine.current?.quit();
    useApp.getState().go('home');
  };

  const restart = () => {
    engine.current?.quit();
    useApp.getState().restartRun();
  };

  useHotkeys({
    Space: begin,
    Enter: begin,
    r: () => phaseRef.current !== 'loading' && restart(),
    Escape: () => {
      const p = phaseRef.current;
      if (p === 'running' || p === 'countdown') pause();
      else quit();
    },
  });

  const hue = hex(palettes[palette][meta.hue]);
  const style = { '--hue': hue } as CSSProperties;

  return (
    <main className="screen run" style={style}>
      <div className="run-canvas" ref={host} />
      <motion.div
        className="run-backdrop"
        layoutId={`card-${run.mode}`}
        animate={{ opacity: phase === 'loading' ? 1 : 0 }}
        transition={{ opacity: { duration: 0.45, delay: 0.1 }, layout: spring.snappy }}
      />

      <Hud ref={hud} visible={started} reducedMotion={rm} />
      {(phase === 'running' || phase === 'countdown') && (
        <button type="button" className="run-pause" aria-label="Pause" onClick={pause}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      )}

      <AnimatePresence>
        {phase === 'intro' && (
          <motion.div
            key="intro"
            className="run-overlay run-intro"
            onClick={begin}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <motion.div className="intro-card" initial={{ y: 20, scale: 0.96 }} animate={{ y: 0, scale: 1 }} transition={spring.soft}>
              <div className="intro-preview">
                <ModePreview mode={run.mode} playing />
              </div>
              <span className="eyebrow">{run.daily ? 'Daily challenge' : meta.skill}</span>
              <h2>{meta.name}</h2>
              <p>{touch ? meta.howToTouch : meta.howTo}</p>
              <div className="intro-cta">
                <span className="pulse-dot" />
                {touch ? (
                  'Tap anywhere to start'
                ) : (
                  <>
                    Click anywhere or press <Kbd>Space</Kbd> to start
                  </>
                )}
              </div>
              {!touch && (
              <div className="intro-keys">
                <span>
                  <Kbd>Esc</Kbd> pause
                </span>
                <span>
                  <Kbd>R</Kbd> restart
                </span>
                {pointerLock && <span className="muted">Your mouse is captured while playing</span>}
              </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {phase === 'paused' && (
          <motion.div
            key="paused"
            className="run-overlay run-paused"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <motion.div className="pause-card" initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} transition={spring.snappy}>
              <h2>Paused</h2>
              <p className="muted">Take a breath. Resuming gives you a 3-second countdown.</p>
              <div className="pause-actions">
                <Button variant="primary" size="lg" kbd="Space" onClick={begin} autoFocus>
                  Resume
                </Button>
                <Button kbd="R" onClick={restart}>
                  Restart
                </Button>
                <Button variant="subtle" kbd="Esc" onClick={quit}>
                  {run.mode === 'zen' ? 'Finish' : 'Quit'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {count != null && (
          <motion.div
            key={count}
            className={`countdown${count === 0 ? ' is-go' : ''}`}
            initial={{ opacity: 0, scale: rm ? 1 : 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: rm ? 1 : 0.7, transition: { duration: 0.18 } }}
            transition={spring.bouncy}
            aria-live="assertive"
          >
            {count === 0 ? 'GO' : count}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
