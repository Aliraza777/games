# Drift

*Breathe. Notice. Return.* A calm, interactive game for releasing stress and training focus, built on well-studied techniques rather than wellness folklore.

```bash
npm run dev -- drift      # from the repo root (or `npm run dev` here)
npm test                  # unit + component tests (Vitest + Testing Library)
npm run e2e               # end-to-end in Chrome, desktop + phone (Playwright)
```

## Practices

| Practice | Goal | Mechanic | Basis |
|---|---|---|---|
| **Sigh** | Calm | Two inhales, one long exhale (2s + 1s, 6s out) | Cyclic sighing improved mood and lowered breathing rate more than mindfulness meditation in a 1-month RCT (Balban et al., *Cell Reports Medicine* 2023) |
| **Tide** | Calm | Even breathing at ~5.5 breaths/min | Resonance breathing near 6/min raises heart-rate variability, which is linked to lower stress |
| **Box** | Focus | 4-4-4-4: in, hold, out, rest | Structured breathing: a simple attention task that also slows the breath |
| **Count** | Focus | Tap each out-breath; press-and-hold the 9th | Modelled on the Breath Counting Task. Noticing you drifted and coming back is the trained skill |
| **Pond** | Unwind | Touch the water: ripples, pentatonic notes, koi | Soft fascination (Attention Restoration Theory) and natural sound for stress recovery |

Sources are linked in the app under **Why it works** and in **Settings → The research behind Drift**.

## Design choices

- **Hold to breathe:** press and hold (mouse, touch or Space) while breathing in, and let go to breathe out. Your light grows with you, and the guide ring brightens when you're in rhythm. If you'd rather not interact, use **Just follow**.
- **No ticking clock:** the sky slowly turns from night to dawn as the session progresses, and sessions always end on a full exhale.
- **A fractal tree grows breath by breath:** its branching ratio of 0.61 gives a fractal dimension of about 1.4, inside the 1.3–1.5 range that research links with lower stress. Each breath in rhythm opens blossoms.
- **Eyes-closed friendly:** synthesized waves swell on the inhale and recede on the exhale, and optional soft chimes mark each phase.
- **Kind feedback:** a miscount or drift simply restarts at one, with an encouraging line. No scores, no fail states.
- **Self-check, not diagnosis:** an optional 0–10 tension rating before and after each session shows what helps you. Drift doesn't measure your body.
- **Accessibility:** three palettes (Ember avoids blue light for bedtime), reduced motion, keyboard-only play, screen-reader cues and focus management in dialogs.

## Code map

```
src/breath/    patterns, timeline (phase/level), sync scoring, breath counter, session controllers  ← pure + tested
src/scene/     Canvas 2D scene (sky, water, fractal tree, fireflies, orb, constellation, koi) + tree geometry
src/audio/     Web Audio soundscape: brown-noise waves, pink-noise rain, bells
src/store/     settings, history (localStorage) and stats (streaks, tension change)
src/app/       React screens: Onboarding, Home + Setup, Session + Summary, Journey, Settings
e2e/           Playwright specs; `?speed=N` fast-forwards session time in dev only
```
