import { motion } from 'motion/react';
import { useEffect, useState, type CSSProperties } from 'react';
import { audio } from '../../audio/AudioManager';
import { modeMeta } from '../../game/modes/meta';
import { fmtInt, fmtMs, fmtPct } from '../../lib/format';
import { useApp } from '../../store/app';
import { useSettings } from '../../store/settings';
import { hex, palettes } from '../../theme/palettes';
import { pageVariants, riseIn, spring, staggerChildren } from '../../theme/motion';
import { Button } from '../components/Button';
import { Heatmap, Histogram } from '../components/Charts';
import { Confetti } from '../components/Confetti';
import { CountUp } from '../components/CountUp';
import { IconHome, IconRetry, IconStats } from '../components/Icons';
import { useHotkeys, useReducedMotion } from '../hooks';

const REVEAL_DELAY = 1100;

export function Results() {
  const r = useApp((s) => s.lastResult)!;
  const prev = useApp((s) => s.previousBest);
  const palette = useSettings((s) => s.palette);
  const rm = useReducedMotion();
  const meta = modeMeta(r.mode);
  const isBest = prev != null && r.score > prev;
  const [skip, setSkip] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) return;
    const t = setTimeout(
      () => {
        setRevealed(true);
        audio.stamp();
        if (isBest) setTimeout(() => audio.fanfare(), 220);
      },
      skip ? 0 : REVEAL_DELAY,
    );
    return () => clearTimeout(t);
  }, [skip, revealed, isBest]);

  // Focus Retry for keyboard users without scrolling the grade out of view.
  useEffect(() => {
    document.querySelector<HTMLButtonElement>('.results-actions .btn-primary')?.focus({ preventScroll: true });
  }, []);

  const { restartRun, go } = useApp.getState();
  useHotkeys({
    r: restartRun,
    Escape: () => go('home'),
    s: () => go('stats'),
    '*': () => setSkip(true),
  });

  const tiles = [
    { label: 'Accuracy', value: r.accuracy, format: fmtPct },
    r.avgReaction != null && { label: r.mode === 'reflex' ? 'Avg reaction' : 'Avg time to hit', value: r.avgReaction, format: (n: number) => fmtMs(n) },
    { label: 'Best combo', value: r.bestCombo, format: (n: number) => `×${Math.round(n)}` },
    r.mode !== 'track' && { label: 'Hits / misses', text: `${r.hits} / ${r.misses}` },
  ].filter(Boolean) as { label: string; value?: number; format?: (n: number) => string; text?: string }[];

  return (
    <motion.main
      className="screen results"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ '--hue': hex(palettes[palette][meta.hue]) } as CSSProperties}
      onPointerDown={() => setSkip(true)}
    >
      <motion.div className="results-inner" variants={staggerChildren(0.07, 0.1)} initial="initial" animate="animate">
        <motion.header className="results-head" variants={riseIn}>
          <span className="chip chip-hue">{meta.name}</span>
          {r.daily && <span className="chip">Daily #{r.seed}</span>}
          <span className="muted">{Math.round(r.duration)}s run</span>
        </motion.header>

        <section className="results-hero">
          <motion.div className="grade-wrap" variants={riseIn}>
            {revealed ? (
              <motion.div
                className={`grade grade-${r.grade}`}
                initial={rm ? { opacity: 0 } : { scale: 2.6, rotate: -18, opacity: 0 }}
                animate={{ scale: 1, rotate: -6, opacity: 1 }}
                transition={spring.bouncy}
                aria-label={`Grade ${r.grade}`}
              >
                {r.grade}
              </motion.div>
            ) : (
              <div className="grade grade-pending" aria-hidden>
                ?
              </div>
            )}
          </motion.div>

          <motion.div className="score-block" variants={riseIn}>
            <span className="eyebrow">Score</span>
            <div className="big-score">
              <CountUp value={r.score} duration={1.1} skip={skip} />
            </div>
            {isBest && revealed ? (
              <motion.div
                className="stamp-best"
                initial={rm ? { opacity: 0 } : { scale: 1.8, opacity: 0, rotate: 8 }}
                animate={{ scale: 1, opacity: 1, rotate: -3 }}
                transition={{ ...spring.bouncy, delay: 0.15 }}
              >
                New best
              </motion.div>
            ) : (
              <span className="muted">
                {prev == null ? 'First run on record — this is your baseline.' : `Personal best ${fmtInt(prev)}`}
              </span>
            )}
          </motion.div>
        </section>

        <motion.section className="stat-tiles" variants={staggerChildren(0.05)}>
          {tiles.map((t) => (
            <motion.div className="tile" key={t.label} variants={riseIn}>
              <span className="tile-label">{t.label}</span>
              <span className="tile-value">
                {t.text ?? <CountUp value={t.value!} format={t.format} skip={skip} duration={0.9} delay={0.2} />}
              </span>
            </motion.div>
          ))}
          {r.extra.map((x) => (
            <motion.div className="tile" key={x.label} variants={riseIn}>
              <span className="tile-label">{x.label}</span>
              <span className="tile-value tile-text">{x.value}</span>
            </motion.div>
          ))}
        </motion.section>

        <motion.section className="results-charts" variants={riseIn}>
          <Heatmap points={r.offsets} label={r.offsetsLabel} />
          {r.histogram && <Histogram data={r.histogram} />}
        </motion.section>

        <motion.footer className="results-actions" variants={riseIn}>
          <Button variant="primary" size="lg" icon={<IconRetry />} kbd="R" onClick={restartRun}>
            Retry
          </Button>
          <Button icon={<IconHome />} kbd="Esc" onClick={() => go('home')}>
            Home
          </Button>
          <Button variant="subtle" icon={<IconStats />} kbd="S" onClick={() => go('stats')}>
            Stats
          </Button>
        </motion.footer>
      </motion.div>
      {isBest && revealed && !rm && <Confetti />}
    </motion.main>
  );
}
