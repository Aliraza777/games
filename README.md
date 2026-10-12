# Pulse

An aim trainer that feels like a game. Six short modes, satisfying hit feedback, and stats that show you *how* you aim — not just how well.

See [plan.md](plan.md) for the design doc and roadmap.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (scoring, RNG) |
| `npm run smoke` | Headless Chrome plays every mode and saves screenshots to `e2e/screenshots` (needs `npm run dev` running and Google Chrome installed) |

## Modes

| Mode | Trains | How it plays |
|---|---|---|
| **Flick** | Speed + accuracy | Targets bloom in; hits shatter into petals |
| **Track** | Smooth tracking | Hold the crosshair on a gliding orb; a hum swells while you're on it |
| **Precision** | Fine control | Shrinking ring targets; center hits slow time |
| **Reflex** | Reaction time | The world breathes, then freezes the instant a target appears |
| **Flow** | Everything | Beat-synced targets with closing approach rings, judged on timing |
| **Zen** | Warm-up | No timer, no score, drifting targets and ambient music |

Plus a **daily challenge** (same seed for everyone each day).

## Controls

`Space` start / resume · `Esc` pause / back · `R` instant retry · `M` mute · `S` stats (home & results)

## How it's built

- **React + Motion** for menus and transitions; **PixiJS v8** renders the game (lazy-loaded when a run starts).
- **Fixed 240 Hz logic step** so scores don't depend on monitor refresh rate. Hit-stop freezes visuals only, never the run clock.
- **Pointer Lock with raw input** (`unadjustedMovement`) and `pointerrawupdate` where supported; falls back to the normal cursor.
- **All audio is synthesized** with Web Audio — hit sounds climb a pentatonic scale with your combo, and Flow's music is scheduled on the `AudioContext` clock so targets stay on the beat.
- **Seeded RNG** (`mulberry32`) for reproducible layouts and the daily challenge.
- **Zustand** stores persisted to **IndexedDB**; the HUD is written imperatively so React never re-renders mid-run.
- Accessibility: colorblind palettes (targets differ by shape too), reduced-motion mode (respects the OS setting), adjustable shake, keyboard-first menus.

```
src/
  app/          React shell — screens/, components/, hooks
  game/
    engine/     Engine (loop, input, scoring hooks, juice), generated textures
    entities/   Target, Crosshair, Trail
    fx/         Particles/ripples/floating text, living background
    modes/      One file per mode + Flow chart generator + UI metadata
    scoring/    Pure scoring/grading functions (unit tested)
  audio/        Synth SFX + music scheduler
  store/        settings, history, app state
  theme/        palettes (single color source), motion springs
```
