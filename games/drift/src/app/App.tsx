import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { sound } from '../audio/soundscape';
import { useApp } from '../store/app';
import { useSettings } from '../store/settings';
import { applyTheme } from '../theme';
import { Backdrop } from './components/Backdrop';
import { useReducedMotion } from './hooks';
import { Home } from './screens/Home';
import { Journey } from './screens/Journey';
import { Onboarding } from './screens/Onboarding';
import { SessionScreen } from './screens/Session';
import { Settings } from './screens/Settings';

export function App() {
  const screen = useApp((s) => s.screen);
  const theme = useSettings((s) => s.theme);
  const volume = useSettings((s) => s.volume);
  const rmSetting = useSettings((s) => s.reducedMotion);
  const rm = useReducedMotion();

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => sound.setVolume(volume), [volume]);
  useEffect(() => {
    document.documentElement.dataset.rm = rm ? 'on' : 'off';
  }, [rm]);
  useEffect(() => {
    if (!useSettings.getState().onboarded) useApp.getState().go('onboarding');
  }, []);

  return (
    <MotionConfig reducedMotion={rmSetting === 'system' ? 'user' : rmSetting === 'on' ? 'always' : 'never'}>
      <Backdrop />
      <AnimatePresence mode="wait">
        {screen === 'onboarding' && <Onboarding key="onboarding" />}
        {screen === 'home' && <Home key="home" />}
        {screen === 'session' && <SessionScreen key="session" />}
        {screen === 'journey' && <Journey key="journey" />}
        {screen === 'settings' && <Settings key="settings" />}
      </AnimatePresence>
    </MotionConfig>
  );
}
