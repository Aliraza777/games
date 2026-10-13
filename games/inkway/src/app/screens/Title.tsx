import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import { VEHICLES, VEHICLE_ORDER, type VehicleId } from '../../game/config';
import { Game } from '../../game/Game';
import { dailySeed, randomSeed } from '../../lib/rng';
import { useApp } from '../../store/app';
import { useRecords } from '../../store/records';
import { prefersReducedMotion, useSettings } from '../../store/settings';
import { Button } from '../components/Button';
import { ControlsCard, Segmented, Slider, Toggle } from '../components/Controls';
import { Logo } from '../components/Logo';
import { VehicleArt } from '../components/VehicleArt';

/** The real game, on autopilot, drawing its own bridges behind the menu. */
function Attract({ vehicle }: { vehicle: VehicleId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [round, setRound] = useState(0);
  const rm = prefersReducedMotion(useSettings((s) => s.reducedMotion));
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const g = new Game(el, {
      vehicle,
      seed: randomSeed(),
      attract: true,
      reducedMotion: rm,
      onOver: () => setRound((r) => r + 1),
    });
    g.start();
    return () => g.destroy();
  }, [vehicle, round, rm]);
  return <canvas ref={canvas} className="attract" aria-hidden />;
}

const isTouchOnly = () =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

export function Title() {
  const vehicle = useSettings((s) => s.vehicle);
  const update = useSettings((s) => s.update);
  const best = useRecords((s) => s.best);
  const daily = useRecords((s) => s.daily);
  const startRun = useApp((s) => s.startRun);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const today = dailySeed();
  const dailyBest = daily?.seed === today ? daily.score : null;

  const pick = (dir: 1 | -1) => {
    const i = VEHICLE_ORDER.indexOf(vehicle);
    update({ vehicle: VEHICLE_ORDER[(i + dir + VEHICLE_ORDER.length) % VEHICLE_ORDER.length] });
    sfx.ensure();
    sfx.ui();
  };
  const ride = () => startRun(vehicle);
  const rideDaily = () => startRun(vehicle, { daily: true, seed: today });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen || e.repeat) return;
      if ((e.target as HTMLElement)?.closest?.('button, input') && (e.key === 'Enter' || e.key === ' ')) return;
      if (e.key === 'Enter') ride();
      else if (e.key === 'ArrowRight') pick(1);
      else if (e.key === 'ArrowLeft') pick(-1);
      else if (e.key.toLowerCase() === 'y') rideDaily();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <motion.main className="screen title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <Attract vehicle={vehicle} />
      <div className="title-scrim" />

      <div className="title-layout">
        <section className="title-main">
          <Logo />
          <motion.p className="tagline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
            Draw the road. <em>Drive the road.</em>
          </motion.p>
          {isTouchOnly() && <p className="touch-note">Inkway needs a keyboard and a mouse or trackpad — one hand drives, the other draws.</p>}

          <div className="garage" role="radiogroup" aria-label="Vehicle">
            {VEHICLE_ORDER.map((id, i) => {
              const v = VEHICLES[id];
              const b = best[id];
              return (
                <motion.button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={vehicle === id}
                  aria-label={`${v.name}: ${v.tagline}`}
                  className={`vehicle-card${vehicle === id ? ' is-active' : ''}`}
                  style={{ ['--v' as string]: v.color }}
                  onClick={() => {
                    update({ vehicle: id });
                    sfx.ensure();
                    sfx.ui();
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <VehicleArt id={id} />
                  <span className="vc-name">{v.name}</span>
                  <span className="vc-tag">{v.tagline}</span>
                  <span className="vc-stats" aria-hidden>
                    {(['speed', 'grip', 'flip'] as const).map((k) => (
                      <span key={k} className="stat">
                        <span>{k}</span>
                        <span className="pips">
                          {[1, 2, 3, 4].map((n) => (
                            <i key={n} className={n <= v.stats[k] ? 'on' : ''} />
                          ))}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="vc-best">{b ? `Best ${b.score.toLocaleString()} · ${b.distance} m` : 'No runs yet'}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="title-actions">
            <Button variant="primary" size="lg" kbd="Enter" onClick={ride}>
              Ride
            </Button>
            <Button kbd="Y" onClick={rideDaily}>
              Daily ride{dailyBest != null ? ` · best ${dailyBest.toLocaleString()}` : ''}
            </Button>
            <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
          </div>
        </section>

        <motion.aside className="title-side" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <h2>Two hands, two jobs</h2>
          <ControlsCard />
          <p className="side-note">
            <span className="ink-word road">Road</span>, <span className="ink-word bounce">bounce</span> and{' '}
            <span className="ink-word boost">boost</span> ink. Flips refill your tank.
          </p>
        </motion.aside>
      </div>

      <AnimatePresence>{settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}</AnimatePresence>
    </motion.main>
  );
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Settings</h2>
        <Slider label="Sound effects" value={s.sfx} onChange={(v) => s.update({ sfx: v })} />
        <Toggle label="Music" checked={s.musicOn} onChange={(v) => s.update({ musicOn: v })} />
        <Slider label="Music volume" value={s.music} onChange={(v) => s.update({ music: v })} />
        <Slider label="Screen shake" value={s.shake} onChange={(v) => s.update({ shake: v })} />
        <Segmented
          label="Reduced motion"
          value={s.reducedMotion}
          options={[
            { value: 'system', label: 'System' },
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(v) => s.update({ reducedMotion: v })}
        />
        <Toggle label="Show tutorial hints" checked={!s.tutorialDone} onChange={(v) => s.update({ tutorialDone: !v })} />
        <div className="sheet-actions">
          <Button variant="primary" onClick={onClose} kbd="Esc">
            Done
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
