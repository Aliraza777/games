import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { sfx } from '../audio/sfx';
import { useApp } from '../store/app';
import { useSettings } from '../store/settings';
import { RunScreen } from './screens/Run';
import { Title } from './screens/Title';

export function App() {
  const screen = useApp((s) => s.screen);
  const sfxVol = useSettings((s) => s.sfx);
  const music = useSettings((s) => s.music);
  const musicOn = useSettings((s) => s.musicOn);
  const rm = useSettings((s) => s.reducedMotion);

  useEffect(() => sfx.setVolumes({ sfx: sfxVol, music }), [sfxVol, music]);
  useEffect(() => {
    if (!musicOn) sfx.stopMusic();
  }, [musicOn]);

  return (
    <MotionConfig reducedMotion={rm === 'system' ? 'user' : rm === 'on' ? 'always' : 'never'}>
      <AnimatePresence mode="wait">
        {screen === 'title' ? <Title key="title" /> : <RunScreen key="run" />}
      </AnimatePresence>
    </MotionConfig>
  );
}
