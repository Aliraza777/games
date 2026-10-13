import { useEffect, useState } from 'react';
import { sound } from '../../audio/soundscape';
import { practice, type PracticeId } from '../../breath/practices';
import { useApp } from '../../store/app';
import { useSettings, type Soundscape } from '../../store/settings';
import { Button } from '../components/Button';
import { Segmented } from '../components/Controls';
import { PracticeGlyph } from '../components/PracticeGlyph';
import { Sheet } from '../components/Sheet';
import { TensionScale } from '../components/TensionScale';

export function SetupSheet({ id, onClose }: { id: PracticeId | null; onClose: () => void }) {
  return (
    <Sheet open={id != null} onClose={onClose} label={id ? `Set up ${practice(id).name}` : 'Set up'}>
      {id && <SetupBody key={id} id={id} />}
    </Sheet>
  );
}

function SetupBody({ id }: { id: PracticeId }) {
  const p = practice(id);
  const settings = useSettings();
  const [minutes, setMinutes] = useState(p.defaultMinutes);
  const [scape, setScape] = useState<Soundscape>(settings.soundscape);
  const [follow, setFollow] = useState(settings.follow);
  const [tension, setTension] = useState<number | null>(null);

  const start = () => {
    sound.ensure();
    useSettings.getState().update({ soundscape: scape, follow });
    useApp.getState().startSession({ practice: id, minutes, soundscape: scape, follow, tensionBefore: tension });
  };

  // Enter starts from anywhere in the sheet (except when a control has focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target as HTMLElement)?.closest('button, a')) start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="setup">
      <header className="setup-head">
        <PracticeGlyph id={id} />
        <div>
          <span className={`chip chip-${p.goal.toLowerCase()}`}>{p.goal}</span>
          <h2>{p.name}</h2>
        </div>
      </header>
      <p className="setup-how">{p.howTo}</p>

      <Segmented
        label="Length"
        value={minutes}
        options={p.durations.map((d) => ({ value: d, label: `${d} min` }))}
        onChange={setMinutes}
      />
      {p.kind === 'paced' && (
        <Segmented
          label="Style"
          hint={follow ? 'Just watch and breathe along' : 'Hold to breathe in, let go to breathe out'}
          value={follow ? 'follow' : 'hold'}
          options={[
            { value: 'hold', label: 'Hold to breathe' },
            { value: 'follow', label: 'Just follow' },
          ]}
          onChange={(v) => setFollow(v === 'follow')}
        />
      )}
      <Segmented
        label="Sound"
        value={scape}
        options={[
          { value: 'waves', label: 'Waves' },
          { value: 'rain', label: 'Rain' },
          { value: 'silence', label: 'Silence' },
        ]}
        onChange={setScape}
      />
      {settings.checkIns && (
        <TensionScale label="How tense do you feel right now? (optional)" value={tension} onChange={setTension} />
      )}

      <Button variant="primary" size="lg" className="setup-start" onClick={start} hint="Enter">
        Begin · {minutes} min
      </Button>
    </div>
  );
}
