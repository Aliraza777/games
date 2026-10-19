import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { ACHIEVEMENTS } from '../../game/achievements';
import { bestPlacement, type Placement } from '../../game/bot';
import { Engine } from '../../game/engine';
import { MODES, MODE_ORDER, dayKey, type ModeId } from '../../game/modes';
import { Renderer } from '../../game/render';
import { themeById } from '../../game/themes';
import { fmtScore, fmtTime, untilMidnight } from '../../lib/format';
import { randomSeed } from '../../lib/rng';
import { useApp } from '../../store/app';
import { dailyStreak, prefersReducedMotion, useProgress, type BoardEntry } from '../../store/progress';
import { Logo } from '../components/Logo';

const ICONS: Record<ModeId, string> = { marathon: '∞', sprint: '⚡', ultra: '⏱', zen: '☯', daily: '★' };

const bestText = (m: ModeId, b?: BoardEntry) => (!b ? 'No record yet' : MODES[m].rank === 'time' ? `Best ${fmtTime(b.timeMs)}` : `Best ${fmtScore(b.score)}`);

/** The bot plays a calm Zen game behind the menu. */
function DemoWell() {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const settings = useProgress((s) => s.settings);
  const live = useRef(settings);
  live.current = settings;
  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const r = new Renderer(canvas);
    const reduced = () => prefersReducedMotion(live.current.reducedMotion);
    const engine = new Engine({ mode: MODES.zen, seed: randomSeed(), onEvent: (ev) => r.onEvent(ev, themeById(live.current.theme), reduced()) });
    engine.start();
    const fit = () => r.fit(wrap.clientWidth, wrap.clientHeight);
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(wrap);
    let plan: Placement | null = null;
    let plannedFor = -1;
    let steps = 0;
    let acc = 0;
    let raf = 0;
    let last = performance.now();
    const tap = (a: Parameters<Engine['press']>[0]) => {
      engine.press(a);
      engine.release(a);
    };
    const frame = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      engine.tick(dt);
      const p = engine.active;
      if (p && plannedFor !== engine.stats.pieces) {
        plannedFor = engine.stats.pieces;
        plan = bestPlacement(engine.board, p.type);
        steps = 0;
        acc = -250;
      }
      acc += dt;
      if (p && plan && acc > 110) {
        acc = 0;
        steps++;
        if (steps > 12) tap('hardDrop');
        else if (p.rot !== plan.rot) tap('cw');
        else if (p.x !== plan.x) tap(plan.x < p.x ? 'left' : 'right');
        else tap('hardDrop');
      }
      r.draw(engine, { theme: themeById(live.current.theme), ghost: true, grid: live.current.grid, reducedMotion: reduced() }, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);
  return (
    <div className="demo-wrap" ref={wrapRef} aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}

export function Title() {
  const play = useApp((s) => s.play);
  const go = useApp((s) => s.go);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setHelpOpen = useApp((s) => s.setHelpOpen);
  const boards = useProgress((s) => s.boards);
  const lastMode = useProgress((s) => s.lastMode);
  const setLastMode = useProgress((s) => s.setLastMode);
  const daily = useProgress((s) => s.daily);
  const achievements = useProgress((s) => s.achievements);
  const lifetime = useProgress((s) => s.lifetime);
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const start = (m: ModeId) => {
    sfx.ensure();
    sfx.ui();
    if (m !== 'daily') setLastMode(m);
    play(m);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useApp.getState().settingsOpen || useApp.getState().helpOpen) return;
      if (e.code === 'Enter' && document.activeElement === document.body) start(useProgress.getState().lastMode);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = daily[dayKey()];
  const streak = dailyStreak(daily);
  const primary = MODES[lastMode] ? lastMode : 'marathon';

  return (
    <motion.div className="screen title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="title-bg" aria-hidden="true" />
      <DemoWell />
      <main className="title-main">
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
          <Logo />
          <p className="tagline">Stack. Spin. Clear. One more run.</p>
        </motion.div>

        <motion.button
          type="button"
          className="btn primary hero"
          onClick={() => start(primary)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          autoFocus
        >
          <span>Play {MODES[primary].name}</span>
          <small>{bestText(primary, boards[primary]?.[0])}</small>
        </motion.button>

        <div className="modes">
          {MODE_ORDER.map((m, i) => (
            <motion.button
              key={m}
              type="button"
              className={`mode-card ${m === primary ? 'current' : ''}`}
              onClick={() => start(m)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="mode-icon" aria-hidden="true">{ICONS[m]}</span>
              <span className="mode-name">{MODES[m].name}</span>
              <span className="mode-tagline">{MODES[m].tagline}</span>
              <span className="mode-best">{bestText(m, boards[m]?.[0])}</span>
            </motion.button>
          ))}
        </div>

        <motion.button type="button" className="daily-card" onClick={() => start('daily')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
          <span className="daily-left">
            <span className="eyebrow">Daily challenge · {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <strong>{today != null ? `Today's best: ${fmtScore(today)}` : 'Same pieces for everyone today'}</strong>
            <span className="muted">3 minutes · new puzzle in {untilMidnight()}</span>
          </span>
          <span className={`streak ${streak > 0 ? 'on' : ''}`} title="Daily streak">
            🔥 <b>{streak}</b>
          </span>
        </motion.button>

        <nav className="title-nav">
          <button type="button" className="btn ghost" onClick={() => go('progress')}>
            Progress <small>{achievements.length}/{ACHIEVEMENTS.length} 🏆</small>
          </button>
          <button type="button" className="btn ghost" onClick={() => setHelpOpen(true)}>
            How to play
          </button>
          <button type="button" className="btn ghost" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </nav>
        {lifetime.games > 0 && (
          <p className="lifetime muted">
            {fmtScore(lifetime.lines)} lines cleared across {lifetime.games} game{lifetime.games === 1 ? '' : 's'}
          </p>
        )}
      </main>
    </motion.div>
  );
}
