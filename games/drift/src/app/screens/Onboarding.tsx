import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/soundscape';
import { PATTERNS } from '../../breath/patterns';
import { PlayerBreath } from '../../breath/sync';
import { capturePointer, getSpeed } from '../../lib/clock';
import { Scene } from '../../scene/Scene';
import { useApp } from '../../store/app';
import { useSettings } from '../../store/settings';
import { THEMES } from '../../theme';
import { Button } from '../components/Button';
import { useKeys, useReducedMotion } from '../hooks';

type Step = 'welcome' | 'inhale' | 'exhale' | 'done';

const COPY: Record<Step, string> = {
  welcome: 'Press and hold anywhere as you breathe in.',
  inhale: 'Keep breathing in… let the light fill.',
  exhale: 'Now let go, and breathe out slowly.',
  done: 'That’s it. That’s the whole game.',
};

/** One guided breath *is* the tutorial. */
export function Onboarding() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const held = useRef(false);
  const stepRef = useRef<Step>('welcome');
  const [step, setStepState] = useState<Step>('welcome');
  const theme = useSettings((s) => s.theme);
  const rm = useReducedMotion();

  const setStep = (s: Step) => {
    stepRef.current = s;
    setStepState(s);
  };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const scene = new Scene(el, THEMES[theme], 'intro', rm, 3);
    const breath = new PlayerBreath(PATTERNS.sigh);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * getSpeed();
      last = now;
      const level = breath.update(held.current, dt);
      scene.guide = level;
      scene.player = null;
      sound.setBreath(level);
      const s = stepRef.current;
      if ((s === 'welcome' || s === 'inhale') && held.current) {
        if (s === 'welcome') setStep('inhale');
        if (level > 0.92) setStep('exhale');
      }
      if (s === 'inhale' && !held.current) setStep(level > 0.5 ? 'exhale' : 'welcome');
      if (s === 'exhale' && !held.current && level < 0.03) {
        setStep('done');
        sound.finish();
      }
      scene.render(dt / getSpeed());
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => scene.resize();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      scene.destroy();
    };
  }, [theme, rm]);

  const finish = () => {
    useSettings.getState().update({ onboarded: true });
    useApp.getState().go('home');
  };

  const press = () => {
    if (stepRef.current === 'done') return;
    if (!held.current) {
      sound.ensure();
      sound.startAmbience('waves');
    }
    held.current = true;
  };
  const release = () => {
    held.current = false;
  };

  useKeys({ Space: press, Enter: () => stepRef.current === 'done' && finish() }, { up: { Space: release } });

  useEffect(() => () => sound.stopAmbience(), []);

  return (
    <motion.main
      className="screen intro"
      data-step={step}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <canvas ref={canvas} className="stage-canvas" />
      <div
        className="stage-hit"
        onPointerDown={(e) => {
          capturePointer(e.currentTarget, e.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      />
      <button type="button" className="skip" onClick={finish}>
        Skip
      </button>
      <div className="intro-copy">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 1.2 }}>
          Drift
        </motion.h1>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            className="cue"
            aria-live="polite"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.8, delay: step === 'welcome' ? 1 : 0 }}
          >
            {COPY[step]}
          </motion.p>
        </AnimatePresence>
        {step === 'welcome' && (
          <motion.p className="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 1 }}>
            Mouse, touch, or the space bar
          </motion.p>
        )}
        {step === 'done' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8 }}>
            <Button variant="primary" size="lg" onClick={finish} data-autofocus>
              Begin
            </Button>
          </motion.div>
        )}
      </div>
    </motion.main>
  );
}
