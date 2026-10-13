import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { HudState } from '../../game/types';
import { fmtInt, fmtPct } from '../../lib/format';

export interface HudHandle {
  update: (s: HudState) => void;
  tierUp: (tier: number) => void;
}

const TIER_TEXT = ['', 'COMBO ×10', 'ON FIRE ×25', 'OVERDRIVE ×50'];

/**
 * Written to imperatively from the game loop — React never re-renders during a run.
 * Score top-center, timer as a hairline along the top edge.
 */
export const Hud = forwardRef<HudHandle, { visible: boolean; reducedMotion: boolean }>(function Hud(
  { visible, reducedMotion },
  ref,
) {
  const fill = useRef<HTMLDivElement>(null);
  const score = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const acc = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const tier = useRef<HTMLDivElement>(null);
  const last = useRef({ score: -1, time: '', acc: '', label: '', progress: -2, showScore: true });

  useImperativeHandle(
    ref,
    () => ({
      update(s) {
        const l = last.current;
        if (s.progress !== l.progress && fill.current) {
          l.progress = s.progress;
          fill.current.style.transform = `scaleX(${Math.max(0, s.progress)})`;
          fill.current.parentElement!.style.opacity = s.progress < 0 ? '0' : '1';
        }
        if (s.showScore !== l.showScore && score.current) {
          l.showScore = s.showScore;
          score.current.style.visibility = s.showScore ? 'visible' : 'hidden';
        }
        if (s.score !== l.score && score.current) {
          const grew = s.score > l.score && l.score >= 0;
          l.score = s.score;
          score.current.textContent = fmtInt(s.score);
          if (grew && !reducedMotion) {
            score.current.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], {
              duration: 160,
              easing: 'cubic-bezier(.22,1,.36,1)',
            });
          }
        }
        const t = s.timeLeft == null ? '' : `${Math.ceil(s.timeLeft)}s`;
        if (t !== l.time && time.current) time.current.textContent = l.time = t;
        const a = s.accuracy == null ? '' : `${fmtPct(s.accuracy)} acc`;
        if (a !== l.acc && acc.current) acc.current.textContent = l.acc = a;
        const lb = s.label ?? '';
        if (lb !== l.label && label.current) label.current.textContent = l.label = lb;
      },
      tierUp(n) {
        const el = tier.current;
        if (!el || !TIER_TEXT[n]) return;
        el.textContent = TIER_TEXT[n];
        el.dataset.tier = String(n);
        el.animate(
          reducedMotion
            ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
            : [
                { opacity: 0, transform: 'translate(-50%, 10px) scale(.7)' },
                { opacity: 1, transform: 'translate(-50%, 0) scale(1.08)', offset: 0.15 },
                { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.75 },
                { opacity: 0, transform: 'translate(-50%, -8px) scale(.96)' },
              ],
          { duration: 1300, easing: 'cubic-bezier(.22,1,.36,1)' },
        );
      },
    }),
    [reducedMotion],
  );

  return (
    <div className={`hud${visible ? ' is-visible' : ''}`} aria-hidden>
      <div className="hud-progress">
        <div className="hud-progress-fill" ref={fill} />
      </div>
      <div className="hud-top">
        <div className="hud-score tnum" ref={score}>
          0
        </div>
        <div className="hud-sub tnum">
          <span ref={time} />
          <span ref={label} />
          <span ref={acc} />
        </div>
      </div>
      <div className="hud-tier" ref={tier} />
    </div>
  );
});
