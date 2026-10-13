import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { practice } from '../../breath/practices';
import { countAccuracy, type CountState } from '../../breath/counter';
import { HARMONY_THRESHOLD } from '../../breath/sync';
import { useApp, type SessionConfig } from '../../store/app';
import { useHistory } from '../../store/history';
import { useSettings } from '../../store/settings';
import { streak, type SessionRecord } from '../../store/stats';
import { Button } from '../components/Button';
import { TensionScale } from '../components/TensionScale';
import { fmtClock, useKeys } from '../hooks';

export interface SessionOutcome {
  config: SessionConfig;
  early: boolean;
  seconds: number;
  breaths?: number;
  harmony?: number | null;
  cycleScores?: number[];
  count?: CountState;
  taps?: number;
  ripples?: number;
}

/** Sessions shorter than this aren't worth cluttering the journey with. */
export const MIN_SAVE_SECONDS = 15;

export function toRecord(o: SessionOutcome, tensionAfter: number | null, now = Date.now()): SessionRecord {
  return {
    id: `${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    practice: o.config.practice,
    date: now,
    seconds: Math.round(o.seconds),
    breaths: o.breaths,
    harmony: o.harmony ?? null,
    tensionBefore: o.config.tensionBefore,
    tensionAfter,
    accuracy: o.count ? countAccuracy(o.count) : null,
    drifts: o.count?.drifts,
  };
}

export function Summary({ outcome }: { outcome: SessionOutcome }) {
  const checkIns = useSettings((s) => s.checkIns);
  const [step, setStep] = useState<'checkout' | 'result'>(checkIns ? 'checkout' : 'result');
  const [after, setAfter] = useState<number | null>(null);
  const [record, setRecord] = useState<SessionRecord | null>(null);
  const saved = useRef(false);
  const p = practice(outcome.config.practice);

  useEffect(() => {
    if (step !== 'result' || saved.current) return;
    saved.current = true;
    const r = toRecord(outcome, after);
    setRecord(r);
    if (outcome.seconds >= MIN_SAVE_SECONDS) useHistory.getState().add(r);
  }, [step, outcome, after]);

  // Move focus to the main action of each step for keyboard and screen-reader users.
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLElement>('.summary-card [data-autofocus]')?.focus({ preventScroll: true }), 900);
    return () => clearTimeout(t);
  }, [step]);

  const { again, go } = useApp.getState();
  useKeys({
    Enter: () => (step === 'checkout' ? setStep('result') : go('home')),
    Escape: () => go('home'),
    r: () => step === 'result' && again(),
  });

  return (
    <motion.div
      className="summary"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, delay: 0.6 }}
      data-testid="summary"
    >
      <motion.div
        className="summary-card"
        key={step}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: step === 'checkout' ? 0.8 : 0 }}
      >
        {step === 'checkout' ? (
          <>
            <h2>{outcome.early ? 'Pausing here is fine.' : 'Welcome back.'}</h2>
            <TensionScale
              label="How tense do you feel now?"
              value={after}
              onChange={setAfter}
              before={outcome.config.tensionBefore}
            />
            {outcome.config.tensionBefore != null && <p className="muted small">The ring marks how you felt before.</p>}
            <div className="summary-actions">
              <Button variant="primary" size="lg" onClick={() => setStep('result')} hint="Enter" data-autofocus>
                {after == null ? 'Skip' : 'Continue'}
              </Button>
            </div>
          </>
        ) : (
          <Result outcome={outcome} record={record} name={p.name} />
        )}
      </motion.div>
    </motion.div>
  );
}

function Result({ outcome, record, name }: { outcome: SessionOutcome; record: SessionRecord | null; name: string }) {
  const sessions = useHistory((s) => s.sessions);
  const { again, go } = useApp.getState();
  const before = outcome.config.tensionBefore;
  const after = record?.tensionAfter ?? null;
  const days = streak(sessions);
  const harmonious = outcome.cycleScores?.filter((s) => s >= HARMONY_THRESHOLD).length ?? 0;

  const lines: { label: string; value: string }[] = [{ label: 'Time', value: fmtClock(outcome.seconds) }];
  if (outcome.breaths != null) lines.push({ label: 'Slow breaths', value: String(outcome.breaths) });
  if (outcome.harmony != null) lines.push({ label: 'In rhythm', value: `${Math.round(outcome.harmony * 100)}%` });
  if (outcome.count) {
    const acc = countAccuracy(outcome.count);
    lines.push({ label: 'Circles closed', value: String(outcome.count.correct) });
    if (acc != null) lines.push({ label: 'Counting accuracy', value: `${Math.round(acc * 100)}%` });
  }
  if (outcome.ripples != null) lines.push({ label: 'Ripples', value: String(outcome.ripples) });

  return (
    <>
      <span className="eyebrow">{name}</span>
      <h2>{outcome.early ? 'Saved. Every minute counts.' : 'Well done.'}</h2>

      <dl className="summary-stats">
        {lines.map((l) => (
          <div key={l.label}>
            <dt>{l.label}</dt>
            <dd className="tnum">{l.value}</dd>
          </div>
        ))}
      </dl>

      {outcome.cycleScores && outcome.cycleScores.length > 0 && (
        <figure className="rhythm" aria-label={`${harmonious} of ${outcome.cycleScores.length} breaths in rhythm`}>
          <div className="rhythm-bars">
            {outcome.cycleScores.map((s, i) => (
              <span
                key={i}
                className={s >= HARMONY_THRESHOLD ? 'on' : ''}
                style={{ height: `${Math.max(8, s * 100)}%`, animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
          <figcaption className="muted small">
            Each bar is one breath. {harmonious} opened a blossom on your tree.
          </figcaption>
        </figure>
      )}

      {outcome.count && outcome.count.drifts > 0 && (
        <p className="note">
          You noticed your mind wander {outcome.count.drifts} {outcome.count.drifts === 1 ? 'time' : 'times'} and came back. That
          noticing is exactly the skill you’re training.
        </p>
      )}

      {before != null && after != null && (
        <p className="tension-result" data-testid="tension-result">
          Tension <b>{before}</b> → <b>{after}</b>
          {after < before && <span className="chip chip-calm">−{before - after}</span>}
          {after >= before && <span className="muted small"> · Some days are like that. Thanks for showing up.</span>}
        </p>
      )}

      {days > 0 && outcome.seconds >= MIN_SAVE_SECONDS && (
        <p className="muted small">
          {days} {days === 1 ? 'day' : 'days'} in a row.
        </p>
      )}

      <div className="summary-actions">
        <Button variant="primary" size="lg" onClick={() => go('home')} hint="Enter" data-autofocus>
          Done
        </Button>
        <Button onClick={again} hint="R">
          Again
        </Button>
      </div>
    </>
  );
}
