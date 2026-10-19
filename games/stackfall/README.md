# Stackfall

*Stack. Spin. Clear. One more run.* A polished falling-block puzzle game with modern guideline-style mechanics, original code, art and sound, and no third-party branding.

```bash
npm run dev -- stackfall   # from the repo root
npm test                   # engine rules (SRS, scoring, T-spins, modes), records, screens
npm run e2e                # Playwright: desktop keyboard bot, phone gestures, on-screen buttons
```

## Modes
- **Marathon**: 150 lines, level and speed rise every 10.
- **Sprint**: 40 lines against the clock.
- **Ultra**: highest score in 2 minutes.
- **Zen**: no game over (topping out clears the well) and calm music.
- **Daily**: a 3-minute score attack where everyone gets the same piece sequence for the day. Playing it keeps a 🔥 streak going.

## How it plays
- Super Rotation System with wall kicks, plus 180° rotation.
- 7-bag randomizer, hold, 5-piece preview and a ghost piece.
- 500 ms lock delay with a 15-move reset cap.
- DAS, ARR and soft-drop speed are all adjustable.
- Guideline scoring: T-spins (including minis), back-to-back ×1.5, combos and all clears.

## Why you'll play again
- **Results screen**: shows a new-best celebration or how far you were from your best, and your top 5 for the mode. **Play again** is one keystroke away (Enter or R).
- **Long-term goals**: 18 achievements, plus 6 block themes that unlock from lifetime lines cleared.
- **During a run**: a live "new best pace" indicator. The music speeds up with level and tenses when the stack gets high.

## Controls
- **Keyboard**:
  - Move: ← →. Rotate: ↑ / X clockwise, Z / Ctrl counter-clockwise, A for 180°.
  - Soft drop: ↓. Hard drop: Space. Hold: C / Shift.
  - Pause: Esc / P. Restart: R.
  - All keys are rebindable in Settings.
- **Touch**:
  - Drag to move, tap to rotate, two-finger tap to rotate back.
  - Drag down to soft drop, flick down to hard drop, swipe up to hold.
  - Optional on-screen buttons.

## Code map
- `src/game/`: the pure, deterministic engine (`engine.ts`), pieces and kick tables, the bag, scoring, modes, the placement bot (used by the title-screen demo and tests), and the canvas renderer.
- `src/store/`: persisted progress (bests, lifetime stats, achievements, daily, settings).
- `src/app/`: screens (Title, Play, Results, Progress) and sheets (Settings, How to play).

Dev and e2e builds expose `window.__stackfall` so tests can read the engine.
