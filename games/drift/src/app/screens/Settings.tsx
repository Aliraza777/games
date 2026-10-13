import { motion } from 'motion/react';
import { sound } from '../../audio/soundscape';
import { PRACTICES } from '../../breath/practices';
import { canVibrate } from '../../lib/clock';
import { useApp } from '../../store/app';
import { useSettings } from '../../store/settings';
import { THEMES, type ThemeId } from '../../theme';
import { Button } from '../components/Button';
import { Segmented, Slider, Toggle } from '../components/Controls';
import { IconBack } from '../components/Icons';
import { useKeys } from '../hooks';

export function Settings() {
  const s = useSettings();
  const go = useApp((st) => st.go);
  useKeys({ Escape: () => go('home') });

  return (
    <motion.main className="screen page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <header className="page-head">
        <Button variant="ghost" icon={<IconBack />} onClick={() => go('home')} hint="Esc">
          Back
        </Button>
        <h1>Settings</h1>
      </header>

      <div className="settings">
        <section className="panel">
          <h2>Atmosphere</h2>
          <div className="themes" role="radiogroup" aria-label="Theme">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const t = THEMES[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={s.theme === id}
                  className={`theme-card${s.theme === id ? ' is-active' : ''}`}
                  onClick={() => s.update({ theme: id })}
                >
                  <span
                    className="theme-swatch"
                    style={{ background: `linear-gradient(${t.skyNight[0]}, ${t.skyNight[1]} 55%, ${t.skyDawn[1]})` }}
                  >
                    <span style={{ background: t.accent }} />
                  </span>
                  <span className="theme-name">{t.label}</span>
                  <span className="theme-desc">{t.description}</span>
                </button>
              );
            })}
          </div>
          <Segmented
            label="Reduced motion"
            hint="Stills the drifting and swaying. The breathing guide always moves."
            value={s.reducedMotion}
            options={[
              { value: 'system', label: 'System' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
            onChange={(v) => s.update({ reducedMotion: v })}
          />
        </section>

        <section className="panel">
          <h2>Sound</h2>
          <Slider
            label="Volume"
            value={s.volume}
            onChange={(v) => {
              s.update({ volume: v });
              sound.ensure();
              sound.setVolume(v);
              sound.ui();
            }}
          />
          <Segmented
            label="Default soundscape"
            value={s.soundscape}
            options={[
              { value: 'waves', label: 'Waves' },
              { value: 'rain', label: 'Rain' },
              { value: 'silence', label: 'Silence' },
            ]}
            onChange={(v) => s.update({ soundscape: v })}
          />
          <Toggle
            label="Breath chimes"
            hint="A soft bell when it’s time to breathe in or out — practise with your eyes closed"
            checked={s.chimes}
            onChange={(v) => s.update({ chimes: v })}
          />
          {canVibrate() && (
            <Toggle label="Gentle vibration" hint="A light tap on each phase change" checked={s.haptics} onChange={(v) => s.update({ haptics: v })} />
          )}
        </section>

        <section className="panel">
          <h2>Practice</h2>
          <Segmented
            label="Breathing style"
            value={s.follow ? 'follow' : 'hold'}
            options={[
              { value: 'hold', label: 'Hold to breathe' },
              { value: 'follow', label: 'Just follow' },
            ]}
            onChange={(v) => s.update({ follow: v === 'follow' })}
          />
          <Toggle
            label="Tension check-ins"
            hint="Rate how tense you feel before and after, so you can see what helps"
            checked={s.checkIns}
            onChange={(v) => s.update({ checkIns: v })}
          />
          <div className="row">
            <div className="row-text">
              <span className="row-label">Intro</span>
              <span className="row-hint">Replay the one-breath welcome</span>
            </div>
            <Button size="sm" onClick={() => (s.update({ onboarded: false }), go('onboarding'))}>
              Show again
            </Button>
          </div>
        </section>

        <section className="panel about">
          <h2>The research behind Drift</h2>
          <p className="muted">
            Drift uses simple, well-studied techniques: slow breathing with long exhales, paced breathing near 5.5 breaths a minute,
            breath counting for focus, and calm natural scenes and sounds. The tree is drawn as a fractal with a dimension around 1.4,
            the mid-range that studies link with lower stress when viewed. Drift doesn’t measure your body. “In rhythm” only compares
            your taps with the guide.
          </p>
          <ul>
            {PRACTICES.flatMap((p) => p.sources.map((src) => ({ ...src, key: p.id + src.url }))).filter(
              (src, i, all) => all.findIndex((o) => o.url === src.url) === i,
            ).map((src) => (
              <li key={src.key}>
                <a href={src.url} target="_blank" rel="noopener noreferrer">
                  {src.label}
                </a>
              </li>
            ))}
            <li>
              <a href="https://bpb-us-e1.wpmucdn.com/blogs.uoregon.edu/dist/e/12535/files/2021/06/SustainabilityTaylor-2021.pdf" target="_blank" rel="noopener noreferrer">
                Taylor (2021): fractal fluency and stress
              </a>
            </li>
          </ul>
          <p className="muted small">Not medical advice. If breathing exercises make you dizzy or uncomfortable, stop and breathe normally.</p>
          <Button variant="ghost" size="sm" onClick={s.reset}>
            Reset settings
          </Button>
        </section>
      </div>
    </motion.main>
  );
}
