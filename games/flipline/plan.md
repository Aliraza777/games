# Flipline: plan

> A faithful **gameplay** replica of Ketchapp's *Rider* (2017): a one-button neon stunt bike. Ketchapp's name, logo, art and exact level layouts are their property and are **not** copied. The code, visuals, sounds and levels are all original.

## 1. What makes Rider *Rider* (and what we replicate)

| Rider trait | Flipline |
|---|---|
| **One button.** Hold to accelerate on the ground. | Hold anywhere (mouse, touch, Space or any key) to drive the rear wheel |
| **Hold in the air to flip** backwards; release to stop rotating | While airborne, holding spins the bike backwards at a controlled rate; release and the spin damps out |
| **Land on your wheels.** Landing on your head ends the attempt. | Rider's head is a crash sensor. Touching the track with it, or falling into the void, crashes. |
| **Flips reward you** with points and a speed burst | Each full flip scores, and a **perfect** landing (nearly flat) adds a bonus and a short speed boost |
| **Neon tracks** on black, a different glow color per level | One glowing line per level, black background, color themes per level |
| **Ramps, gaps, hills and loop-de-loops** | All of them. Loops are one-sided and switch layers once you've gone round, so you exit cleanly. |
| **Checkpoints;** crashing restarts you at the last one instantly | Flags along the level. A crash shows a short slow-mo, then a tap respawns you at the flag. |
| **Collectibles** and bikes to unlock | 3 gems per level; gems unlock 8 original bike designs (cosmetic, like Rider) |
| **Levels** you progress through | 12 handcrafted levels that ramp from gentle hills to loop chains and big gap jumps |
| Instant, wordless onboarding | Level 1 teaches with three hints: *Hold to ride*, *Hold in the air to flip*, *Land on your wheels* |

## 2. Controls

| Input | Ground | Air |
|---|---|---|
| **Hold** (mouse, touch, Space or any key) | Accelerate | Flip backwards |
| **Release** | Coast | Stop rotating |
| Esc / ⏸ | Pause | Pause |
| R | Restart level | Restart level |

## 3. Systems

- **Physics:** planck.js (Box2D).
  - The bike is a chassis plus two wheel joints with spring suspension and a motor on the rear wheel.
  - The rider's head is a sensor.
  - The fixed 60 Hz step is deterministic.
- **Air control:** the bike rotates at a set angular speed while held, so flips are crisp and learnable rather than floaty. Releasing damps the rotation.
- **Flip tracking:** rotation is unwrapped while airborne. On landing it scores full flips, judges the landing angle (perfect ≤ 20°, good ≤ 45°), and gives a speed boost for flips.
- **Loops:** a loop is a circle of track sitting on the ground.
  - It's **one-sided**: it only collides when the bike is inside it, because contacts whose normal points away from the center are disabled.
  - The bike's progress around the center is tracked. After a full lap the loop stops colliding, so the bike rolls out instead of looping forever.
- **Levels as data:** a small builder language (`flat`, `ramp`, `hill`, `gap`, `loop`, `checkpoint`, `gem`, `finish`) turns into track lines, loops, flags and gems.
- **Progress:**
  - Levels unlock in order.
  - Each level records whether it's done, gems found, best flips and best time.
  - Total gems unlock bikes.
  - Everything is saved locally.

## 4. Screens

1. **Title.** Wordmark, the selected bike idling on a glowing line, and a big *Hold to play* prompt (holding starts the next level).
2. **Levels.** A 12-tile grid showing lock state, gems (◆◆◆) and best flips.
3. **Garage.** 8 bikes, each with a name, colors and a gem cost.
4. **Ride.**
   - HUD: level name, progress bar to the finish, flips, gems.
   - Flip callouts: *FLIP ×2*, *PERFECT*.
   - Crash: slow-mo, then *Tap to retry* from the checkpoint.
   - Finish: confetti sparks, then a summary (time, flips, gems, perfects) with *Next level*.

## 5. Feel

- Wheel sparks in the level color, a glowing trail behind the bike, and checkpoint flags that light up.
- Camera look-ahead, plus zoom-out at speed and in the air.
- Screen shake on hard landings, a punchy synthesized engine, flip whooshes, a landing thud, a perfect chime, and a crash.
- Reduced-motion setting: no shake or trails.

## 6. Quality bar ("without errors")

- **Unit tests:**
  - flip counting and landing judgement;
  - the level builder (continuous track, flags in order, finish reachable);
  - progress and unlock rules.
- **Headless physics tests:**
  - the bike accelerates;
  - holding in the air flips it;
  - landing flat survives and landing on the head crashes;
  - **a loop is entered and exited** to the right;
  - a gap jump clears.
- **Solvability:** an autopilot bot (hold on the ground, no flips) finishes **every level** in a headless simulation. A flip bot proves a backflip can be landed on each level's first big jump.
- **Browser tests (Playwright):** desktop and phone. Title → level 1 → hold to ride → reach a checkpoint → crash and respawn → finish → next level unlocked. No console errors; accessibility scan clean.
- Typecheck, production build, then deploy to Vercel as its own project, followed by a live check.
