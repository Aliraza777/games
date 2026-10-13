# Inkway — Draw the road. Drive the road.

> A two-handed game. Your **mouse paints the road** a few meters ahead of a speeding car, bike or monster truck. Your **keyboard drives** over whatever you just drew, across a neon void full of gaps, cliffs and sky.

---

## 1. Why this is different

Most keyboard-and-mouse games split the job the usual way: keys move, mouse aims. Inkway splits it differently: **one hand builds the world while the other survives it.**

- The track doesn't exist until you draw it. Every bridge, ramp and loop is improvised in real time from a moving vehicle.
- Ink is physical. What you draw becomes solid road with real suspension physics, so a sloppy line means a bumpy landing.
- **Three inks:** cyan road, pink bounce (a trampoline) and gold boost (a conveyor). Combining them gives creative solutions: bounce off a pink pad, then catch a gold strip mid-air.
- Flips refill your ink, so playing with style keeps you alive.
- **Hold Shift** to slow time, like bullet-time sketching.

## 2. Core loop (≈ 30 seconds to learn, endless to master)

```
Drive (W) ─► gap/cliff ahead ─► draw bridge / ramp / pad (mouse) ─► cross ─► flip for ink (A/D) ─► repeat, faster
```

The run ends when you fall into the void or land on your roof. Each run scores distance, stars and tricks.

## 3. Controls

| Input | Action |
|---|---|
| **W / ↑** | Throttle |
| **S / ↓** | Brake / reverse |
| **A / D**, **← / →** | Lean back / forward (flips in the air) |
| **Space** | Hop |
| **Shift** (hold) | Focus: slow-motion drawing, drains a meter |
| **Mouse (hold left)** | Draw ink |
| **Right-click** | Erase a stroke (refunds half its ink) |
| **1 / 2 / 3** or **mouse wheel** | Road / bounce / boost ink |
| **Esc** | Pause · **R** restart |

## 4. Vehicles

| | Speed | Grip | Flip | Feel |
|---|---|---|---|---|
| **Car** | ●●●○ | ●●●○ | ●●○○ | Balanced, forgiving suspension |
| **Bike** | ●●●● | ●●○○ | ●●●● | Light and twitchy; the rider's head is the crash sensor |
| **Monster truck** | ●●○○ | ●●●● | ●○○○ | Huge wheels that eat rough lines, but heavy in the air |

## 5. The world

- Procedural and seeded: islands of terrain with gaps, step-up cliffs that need ramps, and occasional updraft vents.
- Difficulty ramps with distance: wider gaps, bigger height changes, shorter islands.
- Pickups:
  - **ink drops**, placed in arcs over gaps;
  - **stars**, placed where only a creative line can reach them.
- **Daily ride:** the same seed for everyone each day.

## 6. Ink economy

| | Cost / meter | Special |
|---|---|---|
| Road | 1.0 | High friction |
| Bounce | 1.6 | Restitution ≈ 1.1 |
| Boost | 2.0 | Surface pushes you forward (tangent speed) |

- The tank holds 100 ink. It refills with ink drops (+18), landed flips (+12 each) and a slow trickle while you're on solid ground.
- You can't draw through your own vehicle, so you can never trap yourself.

## 7. UX and feel

- **Attract mode:** the title screen runs the real game on autopilot, drawing its own bridges, so you see the idea in two seconds.
- **Teaching by situation, not text walls:**
  - "Hold W". Then, at the first gap, time slows on its own and a ghost line shows where to draw.
  - At the first jump: "A/D to flip".
- A custom pen cursor shows the current ink color and how full the tank is.
- **Juice:**
  - neon double-stroke glow and animated dashes on boost ink;
  - wheel dust in the color of the ink you're on;
  - landing sparks, speed lines and camera look-ahead that zooms out with speed;
  - trick callouts and crash slow-mo.
- **Sound** is all synthesized:
  - an engine whose pitch follows wheel speed;
  - a pen-scribble sound while drawing;
  - a boing for bounce ink and a whoosh for boost ink;
  - a synthwave loop.
- **Accessibility:**
  - reduced motion (no shake or speed lines);
  - arrow keys as alternatives;
  - a touch-device notice;
  - pause on blur.

## 8. Tech

| Layer | Choice |
|---|---|
| Physics | **planck.js** (Box2D port): wheel joints with motors and suspension, chain shapes for ink, pre-solve hooks for bounce and boost |
| Rendering | Canvas 2D with a fixed 60 Hz physics step and an interpolated camera |
| UI | React + Motion for menus, HUD and overlays; Zustand for persisted settings and records |
| Audio | Web Audio, synthesized |
| Tests | Vitest (pure logic + headless physics in Node), Testing Library (screens), Playwright (real browser) |

```
src/game/   config, worldgen, ink, tricks (pure, tested) · physics (planck) · Game loop · renderer · autopilot
src/audio/  synth engine, sfx, music
src/app/    Title (attract mode + garage), Run (HUD, pause, game over), settings
```

## 9. Test plan

- **Pure logic:**
  - worldgen is deterministic, gaps are always crossable within ink limits, and difficulty is monotonic;
  - ink costs, refills and the no-draw zone;
  - flip counting with angle unwrapping.
- **Headless physics:** each vehicle drives forward, falls into an open gap, crosses a drawn bridge, launches higher on bounce, goes faster on boost, and crashes on its roof.
- **Screens:** vehicle select persists, a run starts, and the game-over card shows stats and retries.
- **Browser (Playwright):**
  - the attract mode renders;
  - a real player drives and draws a bridge across the first gap with the mouse;
  - ink switching, pause and game-over work;
  - no console errors, desktop and mobile.

## 10. Milestones

1. Physics sandbox: car, flat ground, drawing ink, three inks.
2. World generator, pickups, death, scoring.
3. Rendering pass (neon look), camera, particles.
4. React shell: title + attract mode, HUD, pause, game over, records.
5. Audio, tutorial moments, tricks.
6. Tests at every layer → deploy to Vercel as its own project.

## 11. Later ideas

- Eraser drones that wipe your ink.
- Ghost replays of your best run.
- Shareable seeds.
- A level editor where you pre-draw nothing and only the world is fixed.
- Touch mode with a split-screen thumb pedal.
