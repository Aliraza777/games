# Pulse — An Aim Trainer That Feels Like a Game

> Working title: **Pulse**. A browser-based aim trainer built around feel: every click, hit and miss has motion, sound and feedback. Goal: something people play because it's satisfying, not because it's a chore.

---

## 1. Vision

Most aim trainers are grey rooms with red dots. Pulse does the same job (flicking, tracking, precision, reaction) but plays like a rhythm or arcade game:

- **It's satisfying to play.** Hits pop, combos build up, and the whole screen reacts to how well you're doing.
- **You learn by playing.** No walls of text. The first target *is* the tutorial.
- **It shows you how you're improving.** Stats are shown as visuals (heatmaps, trails, streaks) rather than spreadsheets.
- **It fits short sessions.** Every mode is 30–60 seconds, and "one more run" takes one key press.

### Design pillars
| Pillar | What it means in practice |
|---|---|
| **Responsive** | Input → visual feedback in < 1 frame. No UI animation ever blocks input. |
| **Readable** | A target's state (spawning, live, expiring) is obvious from its shape and motion alone, without relying on color. |
| **Expressive** | Combos, perfect hits and streaks change the visuals: color temperature, particles, background pulse. |
| **Respectful** | Reduced-motion mode, colorblind palettes, adjustable sensitivity, no dark patterns. |

---

## 2. Game Modes

Each mode trains one skill and has its own visual identity.

| Mode | Skill | Mechanic | Visual twist |
|---|---|---|---|
| **Flick** | Speed + accuracy | Targets appear one at a time; click fast. | Targets "bloom" in like flowers; hits shatter into petals. |
| **Track** | Smooth tracking | Hold the cursor on a moving orb that follows a curve. | The orb leaves a light trail. Your cursor trail is drawn too, so you can see the gap. |
| **Precision** | Fine control | Small targets that shrink over time; hitting the center scores more. | Concentric rings. Center hits trigger a slow-mo "ping". |
| **Reflex** | Reaction time | The screen waits, then a target flashes in. | Ambient breathing background that freezes the instant a target appears. |
| **Flow** *(signature mode)* | Everything | Targets spawn on a beat in patterns (arcs, spirals, zig-zags). | Synced to music; background visualizer reacts to your combo. |
| **Zen** | Warm-up | No timer, no score, endless gentle targets. | Soft palette, slow ambient audio. |

### Scoring
- Base points per hit, with multipliers for **speed** (time-to-hit) and **accuracy** (distance from center).
- A **combo meter** grows with consecutive hits and resets on a miss. At ×10, ×25 and ×50 the visuals step up (see §4).
- End-of-run **grade**: S / A / B / C, based on a blend of accuracy, speed and consistency.

---

## 3. UX Flow

```
Launch ──► Instant "First Target" (onboarding) ──► Home
                                                  │
         ┌──────────────┬──────────────┬──────────┴───┬────────────┐
       Play           Stats         Settings       Daily      Customize
         │
   Mode select ──► 3‑2‑1 countdown ──► Run ──► Results ──► [R] Retry / [Esc] Home
```

### Key UX decisions
1. **No loading screen on first visit.** A single target pulses in the middle with the hint "click it". Clicking it explodes into the Home menu. That click is the onboarding.
2. **Keyboard-first loop.** `Space` = start, `R` = instant retry, `Esc` = back. Mouse users never need to leave the play area.
3. **Results stay quick.** Stats count up in under 1.2 s and can be skipped with any key. Only one personal-best callout per run, so it stays special.
4. **Contextual tips, not tutorials.** If accuracy is < 60% three runs in a row, show one tip ("Try lowering sensitivity") in a small toast.
5. **Settings preview live.** Changing crosshair, sensitivity or colors updates a mini playground in the settings panel right away.
6. **Pause is forgiving.** If the window loses focus, the game pauses automatically and resumes with a 3-second countdown.

### Screens
- **Home:** large mode cards with looping micro-previews (a 2-second animated loop of the mode), a daily challenge banner, and a personal-best ticker.
- **Run HUD:** minimal. Score top-center, timer as a thin progress line along the top edge, combo near the crosshair (so eyes stay centered).
- **Results:** grade reveal, a stat breakdown, a **hit heatmap** of where you clicked vs. target centers, and a reaction-time histogram.
- **Stats:** trends over time per mode (sparklines), best runs, a "consistency" score.
- **Customize:** crosshair builder (shape, size, gap, color, outline), target skins, themes, hit sounds.

---

## 4. Animation & Visual Feedback ("Juice")

This is where most of the effort goes.

### Target lifecycle
| State | Animation | Duration |
|---|---|---|
| Spawn | Scale 0 → 1.08 → 1 (back-out ease) and ring ripple outward | 180 ms |
| Idle | Subtle breathing scale (±2%) and soft glow | loop |
| Expiring | Outer ring drains like a clock; color shifts from warm to cool | last 30% of lifetime |
| Hit | Squash, then burst into 8–16 particles; score number floats up and fades | 250 ms |
| Perfect hit | All of the above, plus a white flash ring, a 40 ms hit-stop and a small chromatic shake | 300 ms |
| Miss | Faint red ripple where you clicked; the target fades and drops slightly | 200 ms |

### Combo escalation
- **×10:** background gradient warms up; particle count goes up.
- **×25:** a subtle bloom filter starts; the background pulses on each hit.
- **×50:** "Overdrive". Screen edges glow, music gets an extra layer, and the cursor trail becomes a ribbon.
- **Combo break:** a quick desaturate-and-recover (300 ms), not a punishment flash.

### Micro-interactions (UI)
- Buttons: hover lifts by 2 px with a shadow; press squashes to 0.97; a ripple starts from the cursor position.
- Mode cards: tilt toward the cursor with 3D parallax; the preview loop plays on hover.
- Page transitions: shared-element morph (the mode card expands into the play field).
- Numbers: animated count-ups with tabular figures so they don't jitter.
- Personal best: confetti burst (short) and the "NEW BEST" stamp drops in with a spring.

### Motion principles
- Spring physics for UI (stiffness ~300, damping ~25). Use eased tweens only for game objects that need fixed timing.
- **Nothing longer than 400 ms** blocks interaction.
- Every animation respects `prefers-reduced-motion`. In reduced-motion mode, scale and shake become opacity fades, particles are capped at 4, and there is no screen shake.

---

## 5. Audio
- Layered hit sounds: base click plus a pitch that rises with combo (resetting on a break), which gives a musical feel.
- Perfect hits add a soft chime layer.
- Flow mode: music tracks with known BPM; targets spawn on beats and sub-beats.
- Master, SFX and music volume sliders. Mute is one key (`M`).
- Use the Web Audio API with pre-decoded buffers. **No audio latency on hit.**

---

## 6. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite + TypeScript** | Fast dev loop, typed game logic |
| Game rendering | **PixiJS v8** (WebGL/WebGPU) | Thousands of particles at 144+ fps, filters for bloom/glow |
| UI layer | **React + Motion (Framer Motion)** | Declarative menus, springs, layout/shared-element transitions |
| State | **Zustand** | Tiny and works outside React (the game loop can read and write it) |
| Audio | **Web Audio API** (thin wrapper) or Howler.js | Low-latency SFX |
| Persistence | **IndexedDB** via `idb-keyval` | Run history and settings, offline-first |
| Styling | CSS variables and design tokens | Themes and colorblind palettes in one place |
| Testing | Vitest (logic), Playwright (flows) | Scoring and spawn logic need to be deterministic |

### Architecture
```
src/
  app/            # React shell: routing, screens, overlays
    screens/      # Home, ModeSelect, Run, Results, Stats, Settings, Customize
    components/   # Button, ModeCard, Toast, Slider, CrosshairPreview…
  game/
    engine/       # Game loop (fixed timestep), input, timing, RNG (seeded)
    modes/        # flick.ts, track.ts, precision.ts, reflex.ts, flow.ts, zen.ts
    entities/     # Target, Particle, Trail, Crosshair
    fx/           # ParticlePool, ScreenShake, HitStop, BloomController
    scoring/      # score, combo, grade calculation
  audio/          # AudioManager, beat clock for Flow mode
  store/          # Zustand stores: settings, session, history
  theme/          # tokens.css, palettes (default, deuteranopia, protanopia, tritanopia, high-contrast)
  lib/            # math, easing, storage helpers
```

### Engine notes
- **Fixed-timestep logic (e.g. 240 Hz) with an interpolated render**, so scoring is identical across 60 Hz and 240 Hz monitors.
- **Pointer Lock API** for raw mouse movement in modes that need it; fall back to the absolute cursor otherwise.
- Use `pointerrawupdate` where available for the lowest input latency.
- **Object pooling** for targets and particles, so nothing is allocated in the hot loop.
- **Seeded RNG**, so the daily challenge is the same for everyone and runs can be replayed.
- The game canvas and React UI are layered. React never re-renders during a run; the HUD reads from the store through refs.

---

## 7. Accessibility
- Colorblind-safe palettes. Targets also differ by **shape and ring pattern**, not only color.
- Reduced motion (auto-detected and toggleable).
- Adjustable target size, game speed (0.5× to 1.5×) and timer length.
- Every menu works with the keyboard, with visible focus rings.
- High-contrast theme.
- Screen-reader labels on all menu UI. Results are also given as a text summary.

---

## 8. Retention & Creativity Features (post-MVP)
- **Daily challenge:** one seeded run per day, with a shareable result card (like Wordle squares, but showing your hit pattern).
- **Pattern editor:** users draw custom Flow patterns on a canvas, set the BPM and share them as a URL-encoded string.
- **Ghost replay:** race a translucent replay of your personal best.
- **Achievements:** playful ones ("Hit 100 perfects", "Finish a run without moving the mouse more than 1000 px").
- **Unlockable cosmetics** earned by play (never paid): target skins, trail styles, hit sounds.

---

## 9. Roadmap

### Phase 0: Foundations (week 1)
- [x] Scaffold Vite, TypeScript, React, PixiJS and Zustand
- [x] Design tokens: colors, spacing, type scale, radii, motion durations and springs
- [x] Game loop with fixed timestep, input handling, Pointer Lock
- [x] Layer the PixiJS canvas under the React overlay

### Phase 1: Core loop, Flick mode (week 2)
- [x] Target entity with full lifecycle animations
- [x] Hit detection, scoring, combo
- [x] Particle pool and hit/miss FX
- [x] Minimal HUD, countdown, results screen
- [x] Instant retry (`R`)
- **Milestone:** Flick mode feels great with no menus. *Playtest here before going further.*

### Phase 2: UI shell (week 3)
- [x] Home screen with animated mode cards
- [x] First-target onboarding
- [x] Settings: sensitivity, crosshair, volume, reduced motion
- [x] Shared-element transitions between screens
- [x] Persist settings and run history in IndexedDB

### Phase 3: More modes (weeks 4–5)
- [x] Track (path generation with Catmull-Rom splines, on-target scoring)
- [x] Precision (shrinking targets, center-distance scoring)
- [x] Reflex (randomized delay, reaction-time histogram)
- [x] Zen

### Phase 4: Juice pass (week 6)
- [x] Combo escalation tiers (bloom, background pulse, Overdrive)
- [x] Hit-stop, screen shake, flash ring on perfect hits (white flash ring, not chromatic aberration)
- [x] Audio: pitch-scaled combo hits, perfect chime
- [x] Micro-interactions across all UI
- [x] Reduced-motion variants for everything above

### Phase 5: Flow mode and stats (weeks 7–8)
- [x] Beat clock synced to audio playback
- [x] Pattern library (arc, spiral, zig-zag, star)
- [x] Stats screen: sparklines, heatmaps, consistency score
- [x] Results heatmap and histogram

### Phase 6: Polish and ship (week 9)
- [ ] Accessibility audit (contrast, keyboard, screen reader). Keyboard-first menus, focus rings, ARIA labels and colorblind palettes are in; a formal audit is still to do
- [ ] Performance: steady 144 fps on mid-range hardware (not yet measured on real hardware). [x] < 200 KB initial JS: ~135 KB gzipped, with PixiJS and the engine lazy-loaded
- [ ] PWA: offline play, installable
- [ ] Deploy (Vercel / Netlify / GitHub Pages)

### Post-launch
- [x] Daily challenge (seeded, rotating mode)
- [ ] Ghost replay, pattern editor, achievements, cosmetics

---

## 10. Success Metrics
| Metric | Target |
|---|---|
| Time from page load to first target click | < 5 s |
| Runs per session (median) | ≥ 5 |
| Retry rate (pressing `R` on the results screen) | > 50% |
| Frame time (p95) during Overdrive | < 7 ms (144 fps) |
| Input-to-visual latency | ≤ 1 frame |

---

## 11. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Effects hurt performance or readability | Effects budget per tier, an FPS-adaptive particle cap, and a "Clean" visual preset |
| Audio drifts from beats in Flow mode | Schedule from `AudioContext.currentTime`, not `setTimeout` |
| Pointer Lock quirks across browsers | Feature-detect, fall back to the absolute cursor, test in Chrome, Firefox and Safari |
| Scope creep (editor, multiplayer…) | Hard MVP cut at Phase 6. Everything else goes into the post-launch list |
| Motion sickness | Reduced motion respected by default, shake intensity slider, no full-screen flashes |

---

## 12. Open Questions
- Desktop-only, or support touch/mobile with a separate tap-based ruleset?
- Should there be a leaderboard? (It needs a backend and anti-cheat; probably post-launch.)
- ~~Music licensing for Flow mode~~: resolved. Music is generated procedurally with Web Audio.
