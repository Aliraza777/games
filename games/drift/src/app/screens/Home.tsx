import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { PRACTICES, practice, type PracticeId } from '../../breath/practices';
import { useApp } from '../../store/app';
import { useHistory } from '../../store/history';
import { recentDays, streak } from '../../store/stats';
import { Button } from '../components/Button';
import { IconInfo, IconJourney, IconSettings } from '../components/Icons';
import { PracticeGlyph } from '../components/PracticeGlyph';
import { greeting } from '../hooks';
import { SetupSheet } from './SetupSheet';

/** A gentle suggestion based on the time of day. */
export function suggestion(hour = new Date().getHours()): { id: PracticeId; why: string } {
  if (hour >= 5 && hour < 11) return { id: 'box', why: 'Start the day steady and focused.' };
  if (hour >= 11 && hour < 17) return { id: 'count', why: 'A short reset for a busy mind.' };
  if (hour >= 17 && hour < 22) return { id: 'resonance', why: 'Let the day wash out with the tide.' };
  return { id: 'sigh', why: 'Long exhales to wind down for sleep.' };
}

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
};

export function Home() {
  const sessions = useHistory((s) => s.sessions);
  const { go, openSetup, closeSetup } = useApp.getState();
  const setupFor = useApp((s) => s.setupFor);
  const [openWhy, setOpenWhy] = useState<PracticeId | null>(null);
  const days = streak(sessions);
  const week = Math.round(recentDays(sessions, 7).reduce((s, d) => s + d.minutes, 0));
  const sug = suggestion();
  const sugPractice = practice(sug.id);

  return (
    <motion.main className="screen home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          Drift
        </div>
        <nav aria-label="Main">
          <Button variant="ghost" icon={<IconJourney />} onClick={() => go('journey')} aria-label="Journey">
            Journey
          </Button>
          <Button variant="ghost" icon={<IconSettings />} onClick={() => go('settings')} aria-label="Settings" />
        </nav>
      </header>

      <motion.div className="home-content" initial="initial" animate="animate" transition={{ staggerChildren: 0.08 }}>
        <motion.section className="hello" variants={fade}>
          <h1>{/[?!.]$/.test(greeting()) ? greeting() : `${greeting()}.`}</h1>
          <p className="muted">Take a few slow breaths. Nothing to win, nowhere to be.</p>
          {(days > 0 || week > 0) && (
            <div className="chips">
              {days > 0 && (
                <span className="chip">
                  {days} {days === 1 ? 'day' : 'days'} in a row
                </span>
              )}
              {week > 0 && <span className="chip">{week} min this week</span>}
            </div>
          )}
        </motion.section>

        <motion.section className="suggest" variants={fade} aria-label="Suggested for now">
          <PracticeGlyph id={sug.id} />
          <div className="suggest-text">
            <span className="eyebrow">Suggested for now</span>
            <h2>{sugPractice.name}</h2>
            <p className="muted">{sug.why}</p>
          </div>
          <Button variant="primary" size="lg" onClick={() => openSetup(sug.id)}>
            Begin
          </Button>
        </motion.section>

        <motion.section className="practices" variants={fade} aria-label="Practices">
          {PRACTICES.map((p) => (
            <article key={p.id} className="practice">
              <button type="button" className="practice-main" onClick={() => openSetup(p.id)} aria-label={`${p.name}: ${p.tagline}`}>
                <PracticeGlyph id={p.id} />
                <div>
                  <div className="practice-head">
                    <h3>{p.name}</h3>
                    <span className={`chip chip-${p.goal.toLowerCase()}`}>{p.goal}</span>
                  </div>
                  <p className="muted">{p.tagline}</p>
                </div>
              </button>
              <button
                type="button"
                className="why-toggle"
                aria-expanded={openWhy === p.id}
                aria-controls={`why-${p.id}`}
                onClick={() => setOpenWhy(openWhy === p.id ? null : p.id)}
              >
                <IconInfo width={16} height={16} /> Why it works
              </button>
              <AnimatePresence initial={false}>
                {openWhy === p.id && (
                  <motion.div
                    id={`why-${p.id}`}
                    className="why"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p>{p.why}</p>
                    <ul>
                      {p.sources.map((s) => (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            {s.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          ))}
        </motion.section>

        <motion.p className="disclaimer" variants={fade}>
          Drift is a relaxation tool, not medical care. If you ever feel light-headed, stop and breathe normally.
        </motion.p>
      </motion.div>

      <SetupSheet id={setupFor} onClose={closeSetup} />
    </motion.main>
  );
}
