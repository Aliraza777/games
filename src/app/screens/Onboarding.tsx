import { motion } from 'motion/react';
import { useState } from 'react';
import { audio } from '../../audio/AudioManager';
import { useApp } from '../../store/app';
import { useSettings } from '../../store/settings';
import { useReducedMotion } from '../hooks';

const SHARDS = 14;

/** The first target *is* the tutorial. Click it and the menu blooms out of it. */
export function Onboarding() {
  const [popped, setPopped] = useState(false);
  const rm = useReducedMotion();

  const pop = async () => {
    if (popped) return;
    setPopped(true);
    if (await audio.unlock()) audio.hit(3, true);
    setTimeout(() => {
      useSettings.getState().update({ onboarded: true });
      useApp.getState().go('home');
    }, rm ? 200 : 650);
  };

  return (
    <motion.main className="screen onboarding" exit={{ opacity: 0, transition: { duration: 0.3 } }}>
      <div className="onboard-stage">
        {!popped && (
          <>
            <span className="onboard-wave" />
            <span className="onboard-wave" style={{ animationDelay: '0.8s' }} />
          </>
        )}
        <motion.button
          type="button"
          className="onboard-target"
          aria-label="Click the target to begin"
          autoFocus
          onClick={pop}
          initial={{ scale: 0, opacity: 0 }}
          animate={popped ? { scale: 1.6, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={popped ? { duration: 0.22 } : { type: 'spring', stiffness: 260, damping: 14, delay: 0.25 }}
          whileHover={{ scale: 1.06 }}
        >
          <span className="ot-ring" />
          <span className="ot-ring ot-inner" />
          <span className="ot-dot" />
        </motion.button>

        {popped &&
          !rm &&
          Array.from({ length: SHARDS }, (_, i) => {
            const a = (i / SHARDS) * Math.PI * 2;
            const d = 110 + (i % 3) * 50;
            return (
              <motion.span
                key={i}
                className="onboard-shard"
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 0.2 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
        {popped && (
          <motion.span
            className="onboard-wipe"
            initial={{ scale: 0, opacity: 0.9 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </div>
      <motion.p
        className="onboard-hint"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: popped ? 0 : 1, y: 0 }}
        transition={{ delay: popped ? 0 : 1.1, duration: 0.4 }}
      >
        click it
      </motion.p>
    </motion.main>
  );
}
