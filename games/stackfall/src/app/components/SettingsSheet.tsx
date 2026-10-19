import { useEffect, useState } from 'react';
import { ACTIONS, DEFAULT_HANDLING, SDF_INSTANT, type Action } from '../../game/engine';
import { keyLabel } from '../../lib/format';
import { DEFAULT_KEYS, useProgress, type Settings } from '../../store/progress';
import { Sheet } from './Sheet';

const ACTION_LABEL: Record<Action, string> = {
  left: 'Move left',
  right: 'Move right',
  softDrop: 'Soft drop',
  hardDrop: 'Hard drop',
  cw: 'Rotate clockwise',
  ccw: 'Rotate counter-clockwise',
  r180: 'Rotate 180°',
  hold: 'Hold',
};

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="row toggle">
      <span>
        {label}
        {hint && <small className="muted">{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="row slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={fmt(value)} />
      <output>{fmt(value)}</output>
    </label>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = useProgress((s) => s.settings);
  const update = useProgress((s) => s.updateSettings);
  const resetProgress = useProgress((s) => s.resetProgress);
  const setTutorialDone = useProgress((s) => s.setTutorialDone);
  const [binding, setBinding] = useState<Action | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const h = settings.handling;
  const setH = (p: Partial<Settings['handling']>) => update({ handling: { ...h, ...p } });

  useEffect(() => {
    if (!binding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        // A key can only do one thing: remove it from other actions.
        const keys = Object.fromEntries(ACTIONS.map((a) => [a, settings.keys[a].filter((k) => k !== e.code)])) as Settings['keys'];
        keys[binding] = [e.code, ...keys[binding]].slice(0, 2);
        update({ keys });
      }
      setBinding(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [binding, settings.keys, update]);

  return (
    <Sheet title="Settings" onClose={() => !binding && onClose()} wide>
      <div className="settings">
        <section>
          <h3>Sound</h3>
          <Slider label="Effects" value={settings.sound} min={0} max={1} step={0.05} onChange={(v) => update({ sound: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Music" value={settings.music} min={0} max={1} step={0.05} onChange={(v) => update({ music: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Toggle label="Vibration" hint="On phones that support it" checked={settings.haptics} onChange={(v) => update({ haptics: v })} />
        </section>

        <section>
          <h3>Board</h3>
          <Toggle label="Ghost piece" hint="Shows where the piece will land" checked={settings.ghost} onChange={(v) => update({ ghost: v })} />
          <Toggle label="Grid lines" checked={settings.grid} onChange={(v) => update({ grid: v })} />
          <label className="row">
            <span>Reduce motion</span>
            <select value={settings.reducedMotion} onChange={(e) => update({ reducedMotion: e.target.value as Settings['reducedMotion'] })}>
              <option value="system">Match system</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
        </section>

        <section>
          <h3>Handling</h3>
          <Slider label="DAS" value={h.das} min={50} max={300} step={5} onChange={(v) => setH({ das: v })} fmt={(v) => `${v} ms`} />
          <Slider label="ARR" value={h.arr} min={0} max={100} step={1} onChange={(v) => setH({ arr: v })} fmt={(v) => (v === 0 ? 'instant' : `${v} ms`)} />
          <Slider label="Soft drop" value={h.sdf} min={5} max={SDF_INSTANT} step={1} onChange={(v) => setH({ sdf: v })} fmt={(v) => (v >= SDF_INSTANT ? 'instant' : `${v}×`)} />
          <p className="muted small">DAS is how long you hold before a piece starts sliding; ARR is how fast it slides after that.</p>
          <button type="button" className="btn ghost small" onClick={() => update({ handling: DEFAULT_HANDLING })}>
            Reset handling
          </button>
        </section>

        <section>
          <h3>Keyboard</h3>
          <div className="keybinds">
            {ACTIONS.map((a) => (
              <div className="row" key={a}>
                <span>{ACTION_LABEL[a]}</span>
                <button type="button" className={`keychip ${binding === a ? 'listening' : ''}`} onClick={() => setBinding(a)} aria-label={`Change key for ${ACTION_LABEL[a]}`}>
                  {binding === a ? 'Press a key…' : settings.keys[a].map(keyLabel).join(' / ') || '—'}
                </button>
              </div>
            ))}
          </div>
          <p className="muted small">Pause: Esc or P · Restart: R</p>
          <button type="button" className="btn ghost small" onClick={() => update({ keys: DEFAULT_KEYS })}>
            Reset keys
          </button>
        </section>

        <section>
          <h3>Touch</h3>
          <Toggle label="On-screen buttons" hint="Instead of swipe gestures" checked={settings.touchButtons} onChange={(v) => update({ touchButtons: v })} />
          <button type="button" className="btn ghost small" onClick={() => { setTutorialDone(false); onClose(); }}>
            Show the tutorial again
          </button>
        </section>

        <section>
          <h3>Progress</h3>
          {confirmReset ? (
            <div className="row">
              <span>Erase all scores, stats and achievements?</span>
              <span className="btn-row">
                <button type="button" className="btn danger small" onClick={() => { resetProgress(); setConfirmReset(false); }}>
                  Erase
                </button>
                <button type="button" className="btn ghost small" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </span>
            </div>
          ) : (
            <button type="button" className="btn ghost small" onClick={() => setConfirmReset(true)}>
              Reset progress…
            </button>
          )}
        </section>
      </div>
    </Sheet>
  );
}
