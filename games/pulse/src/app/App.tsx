import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { audio } from '../audio/AudioManager';
import { useApp } from '../store/app';
import { prefersReducedMotion, useSettings } from '../store/settings';
import { applyPalette } from '../theme/palettes';
import { Toasts } from './components/Toasts';
import { useHotkeys, useHydrated } from './hooks';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Results } from './screens/Results';
import { RunScreen } from './screens/Run';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';

export function App() {
  const hydrated = useHydrated();
  const screen = useApp((s) => s.screen);
  const nonce = useApp((s) => s.run?.nonce ?? 0);
  const palette = useSettings((s) => s.palette);
  const rmSetting = useSettings((s) => s.reducedMotion);
  const master = useSettings((s) => s.masterVolume);
  const sfx = useSettings((s) => s.sfxVolume);
  const music = useSettings((s) => s.musicVolume);
  const muted = useSettings((s) => s.muted);

  useEffect(() => applyPalette(palette), [palette]);
  useEffect(() => audio.setVolumes({ master, sfx, music, muted }), [master, sfx, music, muted]);
  useEffect(() => {
    document.documentElement.dataset.rm = prefersReducedMotion(rmSetting) ? 'on' : 'off';
  }, [rmSetting]);
  useEffect(() => {
    if (hydrated && !useSettings.getState().onboarded) useApp.getState().go('onboarding');
  }, [hydrated]);

  useHotkeys({
    m: () => {
      const next = !useSettings.getState().muted;
      useSettings.getState().update({ muted: next });
      useApp.getState().pushToast(next ? 'Sound off' : 'Sound on');
    },
  });

  return (
    <MotionConfig reducedMotion={rmSetting === 'system' ? 'user' : rmSetting === 'on' ? 'always' : 'never'}>
      <div className="app">
        {hydrated && (
          <AnimatePresence initial={false}>
            {screen === 'onboarding' && <Onboarding key="onboarding" />}
            {screen === 'home' && <Home key="home" />}
            {screen === 'run' && <RunScreen key={`run-${nonce}`} />}
            {screen === 'results' && <Results key="results" />}
            {screen === 'stats' && <Stats key="stats" />}
            {screen === 'settings' && <Settings key="settings" />}
          </AnimatePresence>
        )}
        <Toasts />
      </div>
    </MotionConfig>
  );
}
