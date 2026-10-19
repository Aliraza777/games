import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { sfx } from '../audio/sfx';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { HelpSheet } from './components/HelpSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { PlayScreen } from './screens/Play';
import { Progress } from './screens/Progress';
import { Title } from './screens/Title';

export function App() {
  const screen = useApp((s) => s.screen);
  const run = useApp((s) => s.run);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const helpOpen = useApp((s) => s.helpOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const setHelpOpen = useApp((s) => s.setHelpOpen);
  const settings = useProgress((s) => s.settings);

  useEffect(() => {
    sfx.setVolumes(settings.sound, settings.music);
    if (settings.music === 0) sfx.stopMusic();
  }, [settings.sound, settings.music]);

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => sfx.ensure();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const rm = settings.reducedMotion;
  return (
    <MotionConfig reducedMotion={rm === 'system' ? 'user' : rm === 'on' ? 'always' : 'never'}>
      <AnimatePresence mode="wait">
        {screen === 'title' && <Title key="title" />}
        {screen === 'progress' && <Progress key="progress" />}
        {screen === 'play' && run && <PlayScreen key={`play-${run.nonce}`} />}
      </AnimatePresence>
      <AnimatePresence>
        {settingsOpen && <SettingsSheet key="settings" onClose={() => setSettingsOpen(false)} />}
        {helpOpen && <HelpSheet key="help" onClose={() => setHelpOpen(false)} />}
      </AnimatePresence>
    </MotionConfig>
  );
}
