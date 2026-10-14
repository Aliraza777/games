import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { sfx } from '../audio/sfx';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { Garage } from './screens/Garage';
import { Levels } from './screens/Levels';
import { RideScreen } from './screens/Ride';
import { Title } from './screens/Title';

export function App() {
  const screen = useApp((s) => s.screen);
  const settings = useProgress((s) => s.settings);
  useEffect(() => {
    sfx.setVolumes(settings.sound, settings.music ? 0.5 : 0);
    if (!settings.music) sfx.stopMusic();
  }, [settings.sound, settings.music]);
  const rm = settings.reducedMotion;
  return (
    <MotionConfig reducedMotion={rm === 'system' ? 'user' : rm === 'on' ? 'always' : 'never'}>
      <AnimatePresence mode="wait">
        {screen === 'title' && <Title key="title" />}
        {screen === 'levels' && <Levels key="levels" />}
        {screen === 'garage' && <Garage key="garage" />}
        {screen === 'ride' && <RideScreen key="ride" />}
      </AnimatePresence>
    </MotionConfig>
  );
}
