import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buzz, sfx } from '../../audio/sfx';
import { bestPlacement } from '../../game/bot';
import { ACTIONS, Engine, type Action, type EngineEvent, type RunResult } from '../../game/engine';
import { MODES, dailySeed } from '../../game/modes';
import type { PieceType } from '../../game/pieces';
import { Renderer } from '../../game/render';
import { themeById } from '../../game/themes';
import { fmtScore, fmtTime } from '../../lib/format';
import { attachGestures } from '../../lib/gestures';
import { randomSeed } from '../../lib/rng';
import { useApp } from '../../store/app';
import { isTouchDevice, prefersReducedMotion, useProgress, type RecordOutcome } from '../../store/progress';
import { HowToPlay } from '../components/HelpSheet';
import { PiecePreview } from '../components/PiecePreview';
import { Ticker } from '../components/Ticker';
import { Results } from './Results';

type Phase = 'help' | 'countdown' | 'playing' | 'paused' | 'over';

interface Popup {
  id: number;
  title: string;
  sub: string[];
  points: number;
  tone: 'normal' | 'big' | 'epic';
}

interface Hud {
  score: number;
  level: number;
  lines: number;
  hold: PieceType | null;
  canHold: boolean;
  queue: PieceType[];
  b2b: number;
  combo: number;
}

const hudOf = (e: Engine): Hud => ({
  score: e.stats.score,
  level: e.stats.level,
  lines: e.stats.lines,
  hold: e.hold,
  canHold: e.canHold,
  queue: e.queue,
  b2b: Math.max(0, e.b2bChain - 1),
  combo: Math.max(0, e.combo),
});

let popupId = 0;

declare global {
  interface Window {
    __stackfall?: { engine: () => Engine | null; plan: typeof bestPlacement };
  }
}

export function PlayScreen() {
  const run = useApp((s) => s.run)!;
  const go = useApp((s) => s.go);
  const play = useApp((s) => s.play);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const settings = useProgress((s) => s.settings);
  const tutorialDone = useProgress((s) => s.tutorialDone);
  const setTutorialDone = useProgress((s) => s.setTutorialDone);
  const board = useProgress((s) => s.boards[run.mode]);
  const mode = MODES[run.mode];
  const theme = themeById(settings.theme);
  const reduced = prefersReducedMotion(settings.reducedMotion);
  const best = board?.[0];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const exitRef = useRef<'menu' | 'restart' | null>(null);

  const [phase, setPhaseState] = useState<Phase>(tutorialDone ? 'countdown' : 'help');
  const phaseRef = useRef(phase);
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [count, setCount] = useState<number | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [outcome, setOutcome] = useState<{ result: RunResult; rec: RecordOutcome } | null>(null);
  const [cellPx, setCellPx] = useState(28);

  // Latest values for callbacks that live outside React's render cycle.
  const live = useRef({ settings, theme, reduced, mode });
  live.current = { settings, theme, reduced, mode };

  const pushPopup = useCallback((p: Omit<Popup, 'id'>) => {
    const id = ++popupId;
    setPopups((ps) => [...ps.slice(-2), { ...p, id }]);
    setTimeout(() => setPopups((ps) => ps.filter((x) => x.id !== id)), p.tone === 'epic' ? 1800 : 1250);
  }, []);

  const onEvent = useCallback(
    (ev: EngineEvent) => {
      const e = engineRef.current;
      const { settings: st, theme: th, reduced: rm } = live.current;
      rendererRef.current?.onEvent(ev, th, rm);
      const vib = (p: number | number[]) => st.haptics && buzz(p);
      switch (ev.type) {
        case 'move':
          sfx.move();
          return;
        case 'rotate':
          sfx.rotate(ev.spinReady);
          return;
        case 'softDrop':
          return;
        case 'hold':
          sfx.hold();
          break;
        case 'lock':
          sfx.lock(ev.dropped);
          vib(ev.dropped > 0 ? 12 : 6);
          break;
        case 'clear': {
          sfx.clear(ev);
          vib(ev.lines === 4 || ev.spin !== 'none' ? [20, 30, 40] : 18);
          const sub: string[] = [];
          if (ev.b2b) sub.push(`BACK-TO-BACK${ev.b2bChain > 2 ? ` ×${ev.b2bChain - 1}` : ''}`);
          if (ev.combo > 0) sub.push(`COMBO ${ev.combo}`);
          const tone = ev.perfect || ev.spin === 'full' || (ev.lines === 4 && ev.b2b) ? 'epic' : ev.lines >= 3 || ev.spin !== 'none' ? 'big' : 'normal';
          if (ev.perfect) pushPopup({ title: 'ALL CLEAR', sub: [ev.label, ...sub], points: ev.points, tone: 'epic' });
          else if (ev.lines >= 2 || ev.spin !== 'none' || ev.combo > 0 || ev.b2b) pushPopup({ title: ev.label, sub, points: ev.points, tone });
          break;
        }
        case 'levelUp':
          sfx.levelUp();
          pushPopup({ title: `LEVEL ${ev.level}`, sub: ['SPEED UP'], points: 0, tone: 'big' });
          break;
        case 'zenClear':
          sfx.zenClear();
          pushPopup({ title: 'FRESH START', sub: ['The well clears in Zen'], points: 0, tone: 'normal' });
          break;
        case 'end': {
          const exit = exitRef.current;
          exitRef.current = null;
          const rec = useProgress.getState().record(ev.result);
          if (exit === 'menu' && live.current.mode.id !== 'zen') {
            sfx.stopMusic();
            go('title');
            return;
          }
          if (exit === 'restart') {
            play(live.current.mode.id);
            return;
          }
          sfx.stopMusic();
          sfx.gameOver(ev.result.completed || rec.rank === 0);
          if (rec.newBest) sfx.best();
          vib(ev.result.completed ? [30, 40, 30, 40, 60] : [60, 40, 120]);
          setOutcome({ result: ev.result, rec });
          setPhase('over');
          break;
        }
      }
      if (e) setHud(hudOf(e));
    },
    [go, play, pushPopup, setPhase],
  );

  // One engine per run (a new nonce = Play again / Restart).
  useEffect(() => {
    const engine = new Engine({
      mode: MODES[run.mode],
      seed: run.mode === 'daily' ? dailySeed() : randomSeed(),
      handling: live.current.settings.handling,
      onEvent: (ev) => onEvent(ev),
    });
    engineRef.current = engine;
    rendererRef.current = canvasRef.current ? new Renderer(canvasRef.current) : null;
    const wrap = wellRef.current;
    if (wrap && rendererRef.current) setCellPx(rendererRef.current.fit(wrap.clientWidth, wrap.clientHeight));
    setHud(hudOf(engine));
    setOutcome(null);
    setPopups([]);
    if (useProgress.getState().tutorialDone) setPhase('countdown');
    if (import.meta.env.DEV || import.meta.env.VITE_E2E) window.__stackfall = { engine: () => engineRef.current, plan: bestPlacement };
    return () => {
      engineRef.current = null;
      sfx.stopMusic();
    };
  }, [run.nonce, run.mode, onEvent, setPhase]);

  // Keep the well as large as possible in whole cells.
  useLayoutEffect(() => {
    const wrap = wellRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (rendererRef.current) setCellPx(rendererRef.current.fit(wrap.clientWidth, wrap.clientHeight));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Render + simulation loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const e = engineRef.current;
      const r = rendererRef.current;
      let dt = Math.min(100, now - last);
      last = now;
      if (e) {
        if (phaseRef.current === 'playing') {
          while (dt > 0 && e.state === 'playing') {
            const s = Math.min(dt, 8);
            e.tick(s);
            dt -= s;
          }
        }
        const { settings: st, theme: th, reduced: rm, mode: md } = live.current;
        r?.draw(e, { theme: th, ghost: st.ghost, grid: st.grid, reducedMotion: rm }, now, e.danger && e.state === 'playing');
        if (timeRef.current) {
          const t = md.timeLimitMs ? md.timeLimitMs - e.stats.timeMs : e.stats.timeMs;
          timeRef.current.textContent = fmtTime(t, md.id === 'sprint');
          timeRef.current.classList.toggle('urgent', !!md.timeLimitMs && t < 10_000 && e.state === 'playing');
        }
        if (barRef.current) {
          const k = md.lineGoal ? e.stats.lines / md.lineGoal : md.timeLimitMs ? e.stats.timeMs / md.timeLimitMs : 0;
          barRef.current.style.transform = `scaleX(${Math.min(1, k)})`;
        }
        sfx.setMood(e.stats.level, e.danger, md.id === 'zen');
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 3-2-1-GO, both at the start and when resuming.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const e = engineRef.current;
    const first = e?.state === 'ready';
    const gap = first ? 520 : 380;
    const timers: number[] = [];
    if (live.current.settings.music > 0) sfx.startMusic();
    [3, 2, 1, 0].forEach((n, i) =>
      timers.push(
        window.setTimeout(() => {
          setCount(n);
          sfx.countdown(n);
          if (n === 0) {
            const en = engineRef.current;
            if (en) {
              en.handling = live.current.settings.handling;
              if (en.state === 'ready') en.start();
              else en.resume();
              setHud(hudOf(en));
            }
            setPhase('playing');
          }
        }, i * gap),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, setPhase]);

  // Let "GO" linger briefly after play starts.
  useEffect(() => {
    if (count !== 0) return;
    const t = window.setTimeout(() => setCount((c) => (c === 0 ? null : c)), 450);
    return () => clearTimeout(t);
  }, [count]);

  const pause = useCallback(() => {
    const ph = phaseRef.current;
    if (ph !== 'playing' && ph !== 'countdown') return;
    engineRef.current?.pause();
    setCount(null);
    setPhase('paused');
    sfx.ui();
  }, [setPhase]);

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    setPhase('countdown');
  }, [setPhase]);

  const leave = useCallback(
    (to: 'menu' | 'restart') => {
      const e = engineRef.current;
      // Lines from abandoned runs still count towards lifetime stats.
      if (e && e.state !== 'over' && e.stats.pieces > 0) {
        exitRef.current = to;
        e.quit();
        return;
      }
      sfx.stopMusic();
      if (to === 'menu') go('title');
      else play(run.mode);
    },
    [go, play, run.mode],
  );

  // Keyboard
  useEffect(() => {
    const map = new Map<string, Action>();
    for (const a of ACTIONS) for (const k of settings.keys[a]) map.set(k, a);
    const down = (ev: KeyboardEvent) => {
      if (useApp.getState().settingsOpen || ev.metaKey) return;
      const ph = phaseRef.current;
      const e = engineRef.current;
      const a = map.get(ev.code);
      if (ph === 'playing' || ph === 'countdown') {
        if (ev.code === 'Escape' || ev.code === 'KeyP') {
          ev.preventDefault();
          pause();
        } else if (ev.code === 'KeyR' && !a) {
          leave('restart');
        } else if (a && e) {
          ev.preventDefault();
          if (!ev.repeat) e.press(a);
        }
      } else if (ph === 'paused') {
        if (ev.code === 'Escape' || ev.code === 'KeyP') {
          ev.preventDefault();
          resume();
        } else if (ev.code === 'KeyR') leave('restart');
      } else if (a) ev.preventDefault();
    };
    const up = (ev: KeyboardEvent) => {
      const a = map.get(ev.code);
      if (a) engineRef.current?.release(a);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [settings.keys, pause, resume, leave]);

  // Auto-pause when the tab or window loses focus.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden || !document.hasFocus()) pause();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onHide);
    };
  }, [pause]);

  // Touch gestures on the well.
  useEffect(() => {
    const el = wellRef.current;
    if (!el) return;
    return attachGestures(el, {
      enabled: () => phaseRef.current === 'playing' && !live.current.settings.touchButtons,
      cellPx: () => rendererRef.current?.cell ?? 28,
      shift: (d) => engineRef.current?.shift(d),
      softStep: () => engineRef.current?.softStep(),
      hardDrop: () => tap(engineRef.current, 'hardDrop'),
      rotate: (d) => tap(engineRef.current, d === 1 ? 'cw' : 'ccw'),
      hold: () => tap(engineRef.current, 'hold'),
    });
  }, []);

  const startFromHelp = () => {
    setTutorialDone();
    sfx.ensure();
    setPhase('countdown');
  };

  const goal = mode.lineGoal;
  const scoreBeatsBest = mode.rank === 'score' && best && hud && hud.score > best.score;
  const showButtons = settings.touchButtons && isTouchDevice();

  return (
    <motion.div
      className={`screen play mode-${mode.id} ${showButtons ? 'with-pad' : ''}`}
      style={{ ['--accent' as string]: theme.accent, ['--cell' as string]: `${cellPx}px` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="play-bg" aria-hidden="true" />
      <header className="play-top">
        <button type="button" className="icon-btn" onClick={pause} aria-label="Pause" disabled={phase === 'over' || phase === 'help'}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
        </button>
        <span className="mode-tag">{mode.name}</span>
        <span className="spacer" />
      </header>

      <div className="stage">
        <aside className="side side-left">
          <div className="panel hold-panel">
            <span className="eyebrow">Hold</span>
            <PiecePreview type={hud?.hold ?? null} theme={theme} dimmed={!hud?.canHold} className="hold" />
          </div>
          <div className="panel stats" aria-live="off">
            <div className={`stat big ${scoreBeatsBest ? 'beating' : ''}`}>
              <span className="eyebrow">Score</span>
              <strong data-testid="score"><Ticker value={hud?.score ?? 0} /></strong>
              <span className="mini-line">
                Lv {hud?.level ?? 1} · {hud?.lines ?? 0}
                {goal ? `/${goal}` : ''} lines
              </span>
            </div>
            <div className="stat-row">
              <div className="stat">
                <span className="eyebrow">Level</span>
                <strong>{hud?.level ?? 1}</strong>
              </div>
              <div className="stat">
                <span className="eyebrow">Lines</span>
                <strong data-testid="lines">
                  {hud?.lines ?? 0}
                  {goal ? <small>/{goal}</small> : null}
                </strong>
              </div>
            </div>
            <div className="stat time">
              <span className="eyebrow">{mode.timeLimitMs ? 'Time left' : 'Time'}</span>
              <strong className="mono"><span ref={timeRef}>0:00</span></strong>
            </div>
            {best && (
              <div className="stat best">
                <span className="eyebrow">{scoreBeatsBest ? 'New best pace!' : 'Best'}</span>
                <strong className="mono">{mode.rank === 'time' ? fmtTime(best.timeMs) : fmtScore(best.score)}</strong>
              </div>
            )}
          </div>
        </aside>

        <div className="well-wrap" ref={wellRef}>
          <canvas ref={canvasRef} className="well" aria-label="Game board" />
          {(goal || mode.timeLimitMs) && (
            <div className="goal-bar" style={{ width: cellPx * 10 }} aria-hidden="true">
              <div ref={barRef} />
            </div>
          )}
          <div className="popups" aria-live="polite">
            <AnimatePresence>
              {popups.map((p) => (
                <motion.div
                  key={p.id}
                  className={`popup ${p.tone}`}
                  initial={{ opacity: 0, y: 20, scale: 0.7 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                >
                  <div className="popup-title">{p.title}</div>
                  {p.sub.map((s) => (
                    <div key={s} className="popup-sub">{s}</div>
                  ))}
                  {p.points > 0 && <div className="popup-pts">+{fmtScore(p.points)}</div>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {count != null && (
              <motion.div key={count} className={`countdown ${count === 0 ? 'go' : ''}`} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.25 }}>
                {count === 0 ? 'GO' : count}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="side side-right">
          <div className="panel next-panel">
            <span className="eyebrow">Next</span>
            {(hud?.queue ?? []).map((p, i) => (
              <PiecePreview key={i} type={p} theme={theme} className={i === 0 ? 'first' : ''} />
            ))}
          </div>
          <div className="chains">
            <AnimatePresence>
              {!!hud?.b2b && (
                <motion.div className="chain b2b" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} key="b2b">
                  B2B <b>×{hud.b2b}</b>
                </motion.div>
              )}
              {!!hud?.combo && (
                <motion.div className="chain combo" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} key="combo">
                  COMBO <b>{hud.combo}</b>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      {showButtons && <TouchPad engine={engineRef} enabled={phase === 'playing'} />}

      <AnimatePresence>
        {phase === 'help' && (
          <motion.div className="overlay" key="help" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="card" initial={{ y: 20 }} animate={{ y: 0 }}>
              <span className="eyebrow">{mode.name}</span>
              <h2>How to play</h2>
              <HowToPlay />
              <button type="button" className="btn primary block" onClick={startFromHelp} autoFocus>
                Let's go
              </button>
            </motion.div>
          </motion.div>
        )}
        {phase === 'paused' && !settingsOpen && (
          <motion.div className="overlay" key="pause" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="card pause-card" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <h2>Paused</h2>
              <p className="muted">{mode.name} · {fmtScore(hud?.score ?? 0)} pts · {hud?.lines ?? 0} lines</p>
              <div className="stack">
                <button type="button" className="btn primary block" onClick={resume} autoFocus>
                  Resume <kbd>Esc</kbd>
                </button>
                <button type="button" className="btn block" onClick={() => leave('restart')}>
                  Restart <kbd>R</kbd>
                </button>
                <button type="button" className="btn block" onClick={() => setSettingsOpen(true)}>
                  Settings
                </button>
                <button type="button" className="btn ghost block" onClick={() => leave('menu')}>
                  {mode.id === 'zen' ? 'End session' : 'Quit to menu'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {phase === 'over' && outcome && (
          <Results key="results" mode={mode} result={outcome.result} rec={outcome.rec} reduced={reduced} onAgain={() => play(run.mode)} onMenu={() => go('title')} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function tap(e: Engine | null, a: Action) {
  if (!e) return;
  e.press(a);
  e.release(a);
}

const PAD_BUTTONS: { a: Action; label: string; cls?: string }[] = [
  { a: 'hold', label: 'Hold', cls: 'wide' },
  { a: 'ccw', label: '⟲' },
  { a: 'cw', label: '⟳' },
  { a: 'left', label: '◀' },
  { a: 'softDrop', label: '▼' },
  { a: 'right', label: '▶' },
  { a: 'hardDrop', label: 'Drop', cls: 'wide primary' },
];

function TouchPad({ engine, enabled }: { engine: React.RefObject<Engine | null>; enabled: boolean }) {
  return (
    <div className="touchpad" aria-label="Touch controls">
      {PAD_BUTTONS.map((b) => (
        <button
          key={b.a}
          type="button"
          className={`pad-btn a-${b.a} ${b.cls ?? ''}`}
          disabled={!enabled}
          onPointerDown={(e) => {
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            engine.current?.press(b.a);
          }}
          onPointerUp={() => engine.current?.release(b.a)}
          onPointerCancel={() => engine.current?.release(b.a)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
