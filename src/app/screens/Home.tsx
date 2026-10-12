import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { DAILY_MODES, MODES, modeMeta } from '../../game/modes/meta';
import { fmtInt } from '../../lib/format';
import { dailySeed } from '../../lib/rng';
import { useApp } from '../../store/app';
import { bestScore, useHistory } from '../../store/history';
import { useSettings } from '../../store/settings';
import { hex, palettes } from '../../theme/palettes';
import { pageVariants, riseIn, staggerChildren } from '../../theme/motion';
import { Button, Kbd } from '../components/Button';
import { IconCalendar, IconMute, IconSettings, IconStats, IconVolume } from '../components/Icons';
import { Logo } from '../components/Logo';
import { ModeCard } from '../components/ModeCard';
import { useHotkeys } from '../hooks';

export function Home() {
  const runs = useHistory((s) => s.runs);
  const startRun = useApp((s) => s.startRun);
  const go = useApp((s) => s.go);
  const lastMode = useApp((s) => s.lastMode);
  const muted = useSettings((s) => s.muted);
  const palette = useSettings((s) => s.palette);
  const update = useSettings((s) => s.update);

  const seed = dailySeed();
  const dailyMode = modeMeta(DAILY_MODES[seed % DAILY_MODES.length]);
  const dailyBest = bestScore(runs, dailyMode.id, { dailySeed: seed });

  useHotkeys({
    Space: () => startRun(lastMode),
    s: () => go('stats'),
    ',': () => go('settings'),
  });

  return (
    <motion.main className="screen home" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <header className="topbar">
        <Logo />
        <nav className="topbar-actions" aria-label="Main">
          <Button variant="subtle" icon={muted ? <IconMute /> : <IconVolume />} onClick={() => update({ muted: !muted })} aria-label={muted ? 'Unmute (M)' : 'Mute (M)'} />
          <Button variant="subtle" icon={<IconStats />} onClick={() => go('stats')}>
            Stats
          </Button>
          <Button variant="subtle" icon={<IconSettings />} onClick={() => go('settings')}>
            Settings
          </Button>
        </nav>
      </header>

      <motion.div className="home-content" variants={staggerChildren(0.06, 0.05)} initial="initial" animate="animate">
        <motion.section className="hero" variants={riseIn}>
          <h1>
            Train your aim.
            <br />
            <span className="hero-accent">Feel every hit.</span>
          </h1>
          <p className="hero-sub">Six modes. Thirty-second runs. One more try is always one key away.</p>
        </motion.section>

        <motion.section
          className="daily"
          variants={riseIn}
          style={{ '--hue': hex(palettes[palette][dailyMode.hue]) } as CSSProperties}
          aria-label="Daily challenge"
        >
          <div className="daily-icon">
            <IconCalendar />
          </div>
          <div className="daily-text">
            <span className="eyebrow">Daily challenge</span>
            <strong>
              {dailyMode.name} <span className="muted">· seed #{seed}</span>
            </strong>
            <span className="muted">Same targets for everyone today.{dailyBest != null && <> Your best: <b className="tnum">{fmtInt(dailyBest)}</b></>}</span>
          </div>
          <Button variant="primary" onClick={() => startRun(dailyMode.id, { daily: true, seed })}>
            Play daily
          </Button>
        </motion.section>

        <motion.section className="mode-grid" variants={staggerChildren(0.05, 0.1)} aria-label="Modes">
          {MODES.map((m) => (
            <ModeCard key={m.id} meta={m} best={bestScore(runs, m.id)} onPlay={() => startRun(m.id)} />
          ))}
        </motion.section>

        <motion.footer className="home-hints" variants={riseIn}>
          <span>
            <Kbd>Space</Kbd> play {modeMeta(lastMode).name}
          </span>
          <span>
            <Kbd>S</Kbd> stats
          </span>
          <span>
            <Kbd>M</Kbd> mute
          </span>
        </motion.footer>
      </motion.div>
    </motion.main>
  );
}
