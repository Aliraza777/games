import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useApp } from '../../store/app';
import { useSettings, type CrosshairShape } from '../../store/settings';
import { palettes, type PaletteId } from '../../theme/palettes';
import { pageVariants, riseIn, staggerChildren } from '../../theme/motion';
import { Button } from '../components/Button';
import { Segmented, Slider, Swatches, Toggle } from '../components/Controls';
import { IconBack } from '../components/Icons';
import { Playground } from '../components/Playground';
import { useHotkeys } from '../hooks';

const CROSSHAIR_COLORS = ['#ffffff', '#6cf5b0', '#5ee6ff', '#ffe45c', '#ff5c8a', '#a78bfa'];
const pct = (v: number) => `${Math.round(v * 100)}%`;
const times = (v: number) => `${v.toFixed(2)}×`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.section className="settings-section" variants={riseIn}>
      <h2>{title}</h2>
      {children}
    </motion.section>
  );
}

export function Settings() {
  const s = useSettings();
  const go = useApp((st) => st.go);
  useHotkeys({ Escape: () => go('home') });
  const c = s.crosshair;

  return (
    <motion.main className="screen page" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <header className="page-head">
        <Button variant="subtle" icon={<IconBack />} kbd="Esc" onClick={() => go('home')}>
          Back
        </Button>
        <h1>Settings</h1>
        <Button variant="subtle" className="page-head-end" onClick={s.reset}>
          Reset to defaults
        </Button>
      </header>

      <div className="settings-layout">
        <motion.div className="settings-col" variants={staggerChildren(0.05)} initial="initial" animate="animate">
          <Section title="Aim">
            <Slider
              label="Sensitivity"
              hint="Multiplier on raw mouse movement while captured"
              value={s.sensitivity}
              min={0.2}
              max={3}
              step={0.05}
              format={times}
              onChange={(v) => s.update({ sensitivity: v })}
            />
            <Toggle
              label="Capture mouse"
              hint="Pointer lock + raw input. Turn off to use your normal cursor."
              checked={s.pointerLock}
              onChange={(v) => s.update({ pointerLock: v })}
            />
          </Section>

          <Section title="Crosshair">
            <Segmented<CrosshairShape>
              label="Shape"
              value={c.shape}
              options={[
                { value: 'cross-dot', label: 'Cross + dot' },
                { value: 'cross', label: 'Cross' },
                { value: 'dot', label: 'Dot' },
                { value: 'circle', label: 'Circle' },
              ]}
              onChange={(v) => s.updateCrosshair({ shape: v })}
            />
            <Slider label="Size" value={c.size} min={2} max={20} step={1} onChange={(v) => s.updateCrosshair({ size: v })} />
            <Slider label="Gap" value={c.gap} min={0} max={14} step={1} onChange={(v) => s.updateCrosshair({ gap: v })} />
            <Slider label="Thickness" value={c.thickness} min={1} max={6} step={1} onChange={(v) => s.updateCrosshair({ thickness: v })} />
            <Swatches label="Color" value={c.color} colors={CROSSHAIR_COLORS} onChange={(v) => s.updateCrosshair({ color: v })} />
            <Toggle label="Outline" checked={c.outline} onChange={(v) => s.updateCrosshair({ outline: v })} />
          </Section>

          <Section title="Gameplay">
            <Slider label="Target size" value={s.targetScale} min={0.6} max={1.6} step={0.05} format={pct} onChange={(v) => s.update({ targetScale: v })} />
            <Slider
              label="Game speed"
              hint="Target lifetimes, orb speed and Flow tempo"
              value={s.gameSpeed}
              min={0.5}
              max={1.5}
              step={0.05}
              format={times}
              onChange={(v) => s.update({ gameSpeed: v })}
            />
            <Segmented<30 | 45 | 60>
              label="Run length"
              value={s.runLength}
              options={[
                { value: 30, label: '30s' },
                { value: 45, label: '45s' },
                { value: 60, label: '60s' },
              ]}
              onChange={(v) => s.update({ runLength: v })}
            />
          </Section>

          <Section title="Look & feel">
            <Segmented<PaletteId>
              label="Palette"
              hint="Targets also differ by shape, never by color alone"
              value={s.palette}
              options={(Object.keys(palettes) as PaletteId[]).map((id) => ({ value: id, label: palettes[id].label }))}
              onChange={(v) => s.update({ palette: v })}
            />
            <Segmented<'full' | 'clean'>
              label="Effects"
              hint="Clean keeps feedback but drops most particles and glow"
              value={s.effects}
              options={[
                { value: 'full', label: 'Full' },
                { value: 'clean', label: 'Clean' },
              ]}
              onChange={(v) => s.update({ effects: v })}
            />
            <Segmented<'system' | 'on' | 'off'>
              label="Reduced motion"
              value={s.reducedMotion}
              options={[
                { value: 'system', label: 'System' },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              onChange={(v) => s.update({ reducedMotion: v })}
            />
            <Slider label="Screen shake" value={s.shake} min={0} max={1} step={0.05} format={pct} onChange={(v) => s.update({ shake: v })} />
          </Section>

          <Section title="Audio">
            <Slider label="Master" value={s.masterVolume} min={0} max={1} step={0.05} format={pct} onChange={(v) => s.update({ masterVolume: v })} />
            <Slider label="Effects" value={s.sfxVolume} min={0} max={1} step={0.05} format={pct} onChange={(v) => s.update({ sfxVolume: v })} />
            <Slider label="Music" value={s.musicVolume} min={0} max={1} step={0.05} format={pct} onChange={(v) => s.update({ musicVolume: v })} />
            <Toggle label="Mute all" hint="Shortcut: M" checked={s.muted} onChange={(v) => s.update({ muted: v })} />
          </Section>
        </motion.div>

        <aside className="settings-preview">
          <Playground />
        </aside>
      </div>
    </motion.main>
  );
}
