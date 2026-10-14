import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/soundscape';
import { PATTERNS, type PacedId, type PhaseKind } from '../../breath/patterns';
import { practice } from '../../breath/practices';
import { CountSession, PacedSession, type CountResult } from '../../breath/session';
import { HARMONY_THRESHOLD } from '../../breath/sync';
import { sessionLength } from '../../breath/timeline';
import { buzz, capturePointer, getSpeed } from '../../lib/clock';
import { Scene } from '../../scene/Scene';
import { useApp, type SessionConfig } from '../../store/app';
import { useSettings } from '../../store/settings';
import { THEMES } from '../../theme';
import { Button } from '../components/Button';
import { IconClose } from '../components/Icons';
import { fmtClock, isTouchDevice, useKeys, useReducedMotion, useWakeLock } from '../hooks';
import { Summary, type SessionOutcome } from './Summary';

type Stage = 'running' | 'paused' | 'summary';

const CHIME: Record<PhaseKind, 'in' | 'out' | 'hold'> = {
  inhale: 'in',
  topup: 'in',
  hold: 'hold',
  exhale: 'out',
  rest: 'hold',
};

const COUNT_MESSAGES: Partial<Record<NonNullable<CountResult>, string>> = {
  complete: 'Circle closed. Begin again at one.',
  miscount: 'Lost the count? That’s normal. Begin again at one.',
  overflow: 'That was the ninth — hold to close next time. Begin again at one.',
  drift: 'Welcome back. Noticing you drifted is the practice.',
  'too-fast': 'One tap per out-breath — no rush.',
};

export function SessionScreen() {
  const cfg = useApp((s) => s.session)!;
  return <SessionRun key={cfg.nonce} cfg={cfg} />;
}

/** Length shown before the first frame — paced sessions round up to whole breaths. */
function initialSeconds(cfg: SessionConfig): number {
  const kind = practice(cfg.practice).kind;
  if (kind === 'paced') return sessionLength(PATTERNS[cfg.practice as PacedId], cfg.minutes);
  if (kind === 'count') return new CountSession(cfg.minutes).total;
  return cfg.minutes * 60;
}

function SessionRun({ cfg }: { cfg: SessionConfig }) {
  const p = practice(cfg.practice);
  const firstPhase = p.kind === 'paced' ? PATTERNS[cfg.practice as PacedId].phases[0] : null;
  const theme = useSettings((s) => s.theme);
  const chimes = useSettings((s) => s.chimes);
  const haptics = useSettings((s) => s.haptics);
  const rm = useReducedMotion();

  const canvas = useRef<HTMLCanvasElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const paced = useRef<PacedSession | null>(null);
  const counter = useRef<CountSession | null>(null);
  const pond = useRef({ t: 0, total: cfg.minutes * 60, ripples: 0, lastX: -999, lastY: -999, lastAt: -1, pressed: false, nextAuto: 3 });
  const stageRef = useRef<Stage>('running');
  const prefs = useRef({ chimes, haptics });
  prefs.current = { chimes, haptics };

  const [stage, setStageState] = useState<Stage>('running');
  const [cue, setCue] = useState(firstPhase?.cue ?? '');
  const [remaining, setRemaining] = useState(() => initialSeconds(cfg));
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);
  const [idle, setIdle] = useState(false);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);

  useWakeLock(stage !== 'summary');

  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
  };

  // ─── finish ──────────────────────────────────────────────────────────────

  const finish = useCallback(
    (early = false) => {
      if (stageRef.current === 'summary') return;
      const base = { config: cfg, early };
      if (paced.current) {
        const s = paced.current;
        setOutcome({
          ...base,
          seconds: s.t,
          breaths: s.breaths,
          harmony: s.harmony,
          cycleScores: s.follow ? [] : [...s.sync.cycleScores],
        });
      } else if (counter.current) {
        const c = counter.current;
        setOutcome({ ...base, seconds: c.t, count: c.state, taps: c.taps });
      } else {
        setOutcome({ ...base, seconds: pond.current.t, ripples: pond.current.ripples });
      }
      if (paced.current) paced.current.held = false;
      sound.stopAmbience(2.5);
      if (!early) sound.finish();
      setStage('summary');
    },
    [cfg],
  );

  // ─── loop ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const sc = new Scene(el, THEMES[theme], p.kind === 'paced' ? 'paced' : p.kind, rm, cfg.nonce * 97 + 5);
    scene.current = sc;
    if (p.kind === 'paced') paced.current = new PacedSession(PATTERNS[cfg.practice as PacedId], cfg.minutes, cfg.follow);
    if (p.kind === 'count') counter.current = new CountSession(cfg.minutes);
    sound.startAmbience(cfg.soundscape);

    let raf = 0;
    let last = performance.now();
    let lastSecond = -1;
    let blossoms = 0;
    let wave = 0;

    const frame = (now: number) => {
      const realDt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const running = stageRef.current === 'running';
      const dt = running ? realDt * getSpeed() : 0;

      if (paced.current) {
        const s = paced.current;
        const step = s.update(dt);
        sc.guide = step.guide;
        sc.player = step.player;
        sc.progress = s.progress;
        sc.growthTarget = s.progress;
        if (running || step.phaseChanged) sound.setBreath(step.guide);
        if (step.phaseChanged && !step.done) {
          setCue(step.state.phase.cue);
          setCycle(step.state.cycle);
          stageEl.current?.setAttribute('data-phase', step.state.phase.kind);
          if (prefs.current.chimes) sound.phaseChime(CHIME[step.state.phase.kind]);
          buzz(12, prefs.current.haptics);
        }
        if (step.cycleScore != null && step.cycleScore >= HARMONY_THRESHOLD) sc.blossoms = ++blossoms;
        const left = s.total - s.t;
        if (Math.ceil(left) !== lastSecond) {
          lastSecond = Math.ceil(left);
          setRemaining(left);
        }
        if (step.done) finish();
      } else if (counter.current) {
        const c = counter.current;
        const ev = c.update(dt);
        if (ev) onCount(ev);
        sc.count = c.state.count;
        sc.holdProgress = c.holdProgress;
        sc.progress = c.t / c.total;
        wave += dt;
        sound.setBreath(0.5 + 0.5 * Math.sin((wave / 10) * Math.PI * 2));
        if (Math.ceil(c.total - c.t) !== lastSecond) {
          lastSecond = Math.ceil(c.total - c.t);
          setRemaining(c.total - c.t);
        }
        if (c.done) finish();
      } else {
        const pd = pond.current;
        pd.t = Math.min(pd.total, pd.t + dt);
        sc.progress = pd.t / pd.total;
        wave += dt;
        sound.setBreath(0.5 + 0.5 * Math.sin((wave / 9) * Math.PI * 2));
        // The pond keeps itself gently alive even when you just watch.
        if (running && pd.t > pd.nextAuto) {
          pd.nextAuto = pd.t + 4 + Math.random() * 5;
          const w = el.clientWidth, h = el.clientHeight;
          sc.ripple(w * (0.1 + Math.random() * 0.8), h * (0.48 + Math.random() * 0.45), 0.45);
        }
        if (Math.ceil(pd.total - pd.t) !== lastSecond) {
          lastSecond = Math.ceil(pd.total - pd.t);
          setRemaining(pd.total - pd.t);
        }
        if (pd.t >= pd.total) finish();
      }

      sc.render(stageRef.current === 'paused' ? 0 : realDt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => sc.resize();
    const onBlur = () => pause();
    const onVisibility = () => document.hidden && pause();
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      sound.stopAmbience(1);
      sc.destroy();
      scene.current = null;
      paced.current = null;
      counter.current = null;
    };
    // The session is configured once per mount (keyed by nonce).
  }, []);

  // Theme can change live from nowhere in-session, but keep the scene in sync anyway.
  useEffect(() => scene.current?.setTheme(THEMES[theme]), [theme]);

  // ─── input ───────────────────────────────────────────────────────────────

  const messageTimer = useRef<number>(0);
  const say = (text: string) => {
    setMessage(text);
    clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 3800);
  };

  function onCount(ev: CountResult) {
    const sc = scene.current;
    const c = counter.current;
    if (!ev || !sc || !c) return;
    switch (ev) {
      case 'count':
        sc.starLit(c.state.count - 1);
        sound.star(c.state.count);
        buzz(8, prefs.current.haptics);
        break;
      case 'complete':
        sc.ringClosed();
        sound.constellation();
        buzz([10, 60, 10], prefs.current.haptics);
        break;
      case 'miscount':
      case 'overflow':
      case 'drift':
        sc.ringReset();
        sound.gentleReset();
        break;
      default:
        break;
    }
    setCount(c.state.count);
    if (COUNT_MESSAGES[ev]) say(COUNT_MESSAGES[ev]!);
  }

  const press = (x?: number, y?: number) => {
    if (stageRef.current !== 'running') return;
    sound.ensure();
    if (paced.current) paced.current.held = true;
    if (counter.current) counter.current.press();
    if (p.kind === 'pond' && x != null && y != null) {
      pond.current.pressed = true;
      splash(x, y, true);
    }
  };

  const release = () => {
    if (paced.current) paced.current.held = false;
    if (counter.current) onCount(counter.current.release());
    pond.current.pressed = false;
  };

  const splash = (x: number, y: number, force = false) => {
    const pd = pond.current;
    const now = performance.now() / 1000;
    if (!force && (Math.hypot(x - pd.lastX, y - pd.lastY) < 34 || now - pd.lastAt < 0.12)) return;
    pd.lastX = x;
    pd.lastY = y;
    pd.lastAt = now;
    pd.ripples++;
    scene.current?.ripple(x, y, force ? 1 : 0.7);
    const el = canvas.current;
    if (el) sound.note(y / el.clientHeight, x / el.clientWidth);
    stageEl.current?.setAttribute('data-ripples', String(pd.ripples));
  };

  function pause() {
    if (stageRef.current !== 'running') return;
    release();
    setStage('paused');
    sound.stopAmbience(0.6);
  }

  const resume = () => {
    if (stageRef.current !== 'paused') return;
    setStage('running');
    sound.startAmbience(cfg.soundscape);
  };

  useKeys(
    {
      Space: () => (stageRef.current === 'paused' ? resume() : press()),
      Escape: () => (stageRef.current === 'running' ? pause() : stageRef.current === 'paused' ? resume() : undefined),
      Enter: () => counter.current && stageRef.current === 'running' && onCount(counter.current.close()),
      d: () => counter.current && stageRef.current === 'running' && onCount(counter.current.drift()),
    },
    { up: { Space: release } },
  );

  // Fade the chrome away when you're still; bring it back on movement.
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), 3500);
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 3500);
    };
    window.addEventListener('pointermove', wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointermove', wake);
    };
  }, []);

  const showHint = p.kind === 'paced' ? cycle < 2 : true;
  const hint =
    p.kind === 'paced'
      ? cfg.follow
        ? 'Just follow the light'
        : isTouchDevice()
          ? 'Hold anywhere while breathing in · let go to breathe out'
          : 'Hold anywhere (or Space) while breathing in · let go to breathe out'
      : p.kind === 'count'
        ? 'Tap on each out-breath · press and hold on the ninth'
        : 'Touch or drag across the water';

  return (
    <motion.main
      className={`screen session${idle && stage === 'running' ? ' is-idle' : ''}`}
      data-practice={cfg.practice}
      data-stage={stage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <canvas ref={canvas} className="stage-canvas" />
      <div
        ref={stageEl}
        className="stage-hit"
        data-testid="stage"
        data-phase={firstPhase?.kind}
        onPointerDown={(e) => {
          if (stageRef.current !== 'running') return;
          capturePointer(e.currentTarget, e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          press(e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerMove={(e) => {
          if (p.kind !== 'pond' || !pond.current.pressed) return;
          const r = e.currentTarget.getBoundingClientRect();
          splash(e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      />

      {stage !== 'summary' && (
        <>
          <header className="session-top chrome">
            <Button variant="ghost" icon={<IconClose />} onClick={pause} aria-label="Pause" hint="Esc" />
            <div className="session-title">
              <span>{p.name}</span>
              <span className="muted tnum" aria-label="Time remaining">
                {fmtClock(remaining)}
              </span>
            </div>
            <span className="session-top-spacer" />
          </header>

          <div className="session-cue">
            {p.kind === 'paced' && (
              <AnimatePresence mode="wait">
                <motion.p
                  key={cue + cycle}
                  className="cue"
                  data-testid="cue"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.6 }}
                >
                  {cue}
                </motion.p>
              </AnimatePresence>
            )}
            {p.kind === 'count' && (
              <p className="count-number tnum" aria-live="polite" data-testid="count">
                {count === 0 ? 'Begin at one' : `${count} of 9`}
              </p>
            )}
            <p className="sr-only" aria-live="polite">
              {p.kind === 'paced' ? cue : ''}
            </p>
            <AnimatePresence mode="wait">
              {message && (
                <motion.p
                  key={message}
                  className="message"
                  role="status"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {message}
                </motion.p>
              )}
            </AnimatePresence>
            {showHint && <p className="hint chrome">{hint}</p>}
          </div>

          {p.kind === 'count' && (
            <div className="session-actions chrome">
              <Button variant="ghost" size="sm" hint="D" onClick={() => onCount(counter.current?.drift() ?? null)}>
                I drifted
              </Button>
            </div>
          )}
          {p.kind === 'pond' && (
            <div className="session-actions chrome">
              <Button variant="ghost" size="sm" onClick={() => finish(true)}>
                I’m done
              </Button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {stage === 'paused' && (
          <motion.div
            className="pause"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div className="pause-card" role="dialog" aria-modal="true" aria-label="Paused" initial={{ y: 16 }} animate={{ y: 0 }}>
              <h2>Paused</h2>
              <p className="muted">Take your time.</p>
              <div className="pause-actions">
                <Button variant="primary" size="lg" onClick={resume} hint="Space" autoFocus>
                  Continue
                </Button>
                <Button onClick={() => finish(true)}>End & save</Button>
                <Button variant="ghost" onClick={() => useApp.getState().go('home')}>
                  Leave without saving
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {stage === 'summary' && outcome && <Summary outcome={outcome} />}
    </motion.main>
  );
}
