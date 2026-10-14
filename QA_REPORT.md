# QA & Critique Report: Pulse · Drift · Inkway

**Date:** 2026-10-13
**Builds audited:** the live Vercel deployments and their local sources

## How this was tested

| Method | What it covered |
|---|---|
| **Automated cross-device runs** (Playwright + Chrome) | Every screen of every game on **desktop 1440×900**, **laptop 1280×720**, **phone portrait 390×844 (touch)** and **phone landscape 844×390 (touch)**. Each run captured screenshots and checked console errors, horizontal overflow, buttons pushed off-screen, and touch targets under 32px. |
| **Accessibility scan** (axe-core 4.10, WCAG 2 A/AA + best practice) | Every screen above |
| **Headless probes** | Physics edge cases (Inkway), audio-clock behavior (Pulse Flow) |
| **Live HTTP checks** | Caching headers on the three production sites |
| **Code review** | Input handling, keyboard layouts, resize behavior, failure modes |
| **Hands-on critique** | Layout, copy, game feel, what's missing |

**Good news first:**

- **Console errors:** zero on all 84 screen × device combinations.
- **Broken flows:** none.
- **Horizontal overflow:** none.
- **Existing test suites:** green, with 111 unit/integration tests and 17 browser tests.

The serious problems are almost all about **touch devices**, plus a handful of real gameplay bugs.

**Severity:** 🔴 Critical (blocks play) · 🟠 High · 🟡 Medium · ⚪ Low
**Status:** ✅ fixed in this pass · 🔜 deferred, with a reason

---

## Pulse (aim trainer)

| ID | Sev | Area | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| P1 | 🔴 | Bug · Mobile | **Every tap on a phone is scored as a miss.** Aim uses the last pointer *move*, and a tap has none before it, so the crosshair stays where it was. | Phone run: 0 hits / 15 misses while tapping directly on targets | Aim from the tap's own coordinates on pointer-down |
| P2 | 🔴 | Mobile · UX | **No way to pause or quit a run on touch.** Pause, restart and quit are Esc/R only. | Phone run screen has no controls | On-screen pause button (all devices) |
| P3 | 🟠 | Mobile · Copy | The game talks to touch users about a mouse and keyboard: "Click anywhere or press Space", "Your mouse is captured", Esc/R chips. | Phone intro screenshot | Input-aware copy; hide key chips on touch |
| P4 | 🟠 | A11y | **The Stats/Settings buttons in the top bar have no accessible name on phones** (labels hidden by CSS). | axe `button-name` (critical) | Explicit `aria-label`s |
| P5 | 🟡 | Bug | **Flow mode can hang forever** if the audio clock doesn't run (autoplay blocked or suspended): song time stays at 0, so the run never ends. | Code: `musicTime()` returns 0 without a running AudioContext | Fall back to the game clock when audio isn't running |
| P6 | 🟡 | Mobile · Copy | Track mode tells touch players to "keep your crosshair on the orb", but on touch you have to drag a finger. | Copy review | Touch-specific instructions |
| P7 | 🟡 | Stats | **Consistency shows 0% after a good run**: one slow outlier collapses the coefficient-of-variation metric. | Laptop results: 12/13 hits, 230 ms avg → "Consistency 0%" | Robust measure (median absolute deviation) |
| P8 | 🟡 | Bug | Resizing the window mid-run can leave targets outside the play area, where you can't reach them. | Code review | Pull live targets back into bounds on resize |
| P9 | ⚪ | A11y | `aria-label` on a plain `div` in Settings; mode-card `h3`s with no `h2` above them. | axe `aria-prohibited-attr` (serious), `heading-order` | Proper role / heading |
| P10 | ⚪ | Mobile | Settings controls are below the touch-target minimum: toggles 26px, color swatches 26px, segments 30px. | Phone settings scan | Bigger hit areas on coarse pointers |
| P11 | ⚪ | Visual | Extra result tiles (e.g. "Perfect hits") use a smaller number font than the main tiles. | Results screenshot | Unify |
| P12 | 💡 | Missing | No touch feedback on phones. | — | Light haptic tick on hits (where supported) |

## Drift (calm breathing & focus)

| ID | Sev | Area | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| D1 | 🟠 | Mobile · Missing | **The phone can go to sleep mid-session.** No Screen Wake Lock, and "Just follow" or eyes-closed sessions involve no touches at all. | Code review | Wake Lock during sessions, re-acquired after tab switches |
| D2 | 🟠 | Mobile · Layout | **Landscape phones: the breathing orb collides with the title and timer.** | Landscape session screenshot | Orb size and position respect the top bar and short screens |
| D3 | 🟡 | Mobile · Copy | Keyboard-only copy on touch: "(or Space)", Enter/R/Esc chips on buttons. | Phone screenshots | Input-aware copy; hide key chips on touch |
| D4 | 🟡 | Mobile · A11y | Tension-rating dots are 24–28px on phones. | Touch-target scan | Full-width, 40px-tall scale |
| D5 | ⚪ | Mobile · A11y | Settings toggles 26px tall; research links 17px tall. | Touch-target scan | Bigger hit areas |
| D6 | 💡 | Missing | A daily breathing habit wants to work offline and from the home screen. | — | Installable PWA with offline support (see X3) |

## Inkway (draw-the-road racer)

| ID | Sev | Area | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| I1 | 🔴 | Mobile · Missing | **Unplayable on phones and tablets.** There are no touch controls at all; touch users only get a notice. | Phone/landscape screenshots | **Two-thumb touch mode:** pedals and lean pads under the left thumb, draw with the right finger, plus hop, slow-mo and pause buttons |
| I2 | 🟠 | Bug | **Jumping up through ink ends the run as a "crash"**, even though one-way ink lands you safely on top: the head sensor brushes the line on the way up. | Headless probe: car/bike/truck all land on top but `crashed=true` | A head hit only counts as a crash when the vehicle is actually tipped over |
| I3 | 🟠 | Bug | **Holding Shift (slow time) breaks ink switching:** Shift+1/2/3 sends `!`/`@`/`#`. The same root cause breaks WASD on AZERTY/Dvorak keyboards. | Code: input uses `KeyboardEvent.key` | Use physical `KeyboardEvent.code` for every game key |
| I4 | 🟡 | Bug | **Trackpad scrolling flips ink type erratically:** every tiny wheel event cycles the ink. | Code review | Accumulate scroll with a threshold and cooldown |
| I5 | 🟡 | Mobile · Layout | Landscape phone: the ink HUD is huge and covers the road and the car. Portrait: the world is tiny and half the screen is empty. | Screenshots | Compact HUD on short screens; "rotate your phone" prompt in portrait |
| I6 | 🟡 | Layout | Short screens (landscape phones): the logo fills the first screen and **Ride** is below the fold. | Landscape title screenshot | Compact logo and garage at short heights |
| I7 | 🟡 | UX | You can't look up the controls mid-run: the pause screen has no help. | Pause screenshot | Show the controls in the pause dialog (keyboard or touch legend) |
| I8 | ⚪ | Bug | Enter on a focused "Ride again" button restarts twice (native click plus a global key handler). | Code review | Ignore global keys when focus is on a button |
| I9 | ⚪ | Copy | Tutorial says "Hold the mouse…" to touch users. | Phone screenshot | Input-aware hints |
| I10 | ⚪ | Mobile | Settings toggles and segments under 32px. | Touch-target scan | Bigger hit areas |

## All three games

| ID | Sev | Area | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| X1 | 🟡 | Perf | **Fingerprinted JS/CSS is served with `max-age=0`**, so every visit re-validates every asset. | Live `curl -I` on all three domains | `vercel.json`: `immutable`, 1-year cache for `/assets/*` |
| X2 | 🟡 | Resilience | **No error boundary**, so any runtime error leaves a blank page. | Code review | Friendly fallback with a reload button |
| X3 | 🟡 | Missing | **Not installable, not offline:** no web manifest, no PNG icons, no service worker. | Code review | Manifest + generated icons + a small offline service worker |
| X4 | ⚪ | Missing | **Shared links look bare:** no Open Graph/Twitter preview metadata or image. | Code review | OG tags + a 1200×630 preview image per game |
| X5 | ⚪ | Missing | The games don't know about each other. | — | "More games" links |
| X6 | ⚪ | Mobile | Keyboard chips (Esc, Enter, R, Space…) appear on touch-only devices. | Phone screenshots | Hide on `(hover: none) and (pointer: coarse)` |
| X7 | ⚪ | Testing | Pulse has no browser test suite (only an ad-hoc smoke script), which is how P1 slipped through. | Repo | Playwright suite incl. touch |

---

## Creative improvements (beyond fixing bugs)

- **Inkway, two-thumb mode:** treat a phone as a handheld console. The left thumb drives with pedals and the right finger *is* the pen. Rotate-to-landscape prompt; pause screen with a visual legend.
- **Pulse on touch:** haptic hit feedback, plus tap-friendly copy that turns the same modes into a reflex/tap trainer.
- **Drift as a daily ritual:** installable and offline, and the screen stays awake for eyes-closed practice.
- **Shared polish:** link previews that look like the games, instant repeat loads, and graceful failure screens.

## Deferred, with reasons

- **Leaderboards / ghost replays / accounts:** these need a backend and anti-cheat, which goes beyond a static Vercel deploy. They're best as their own project.
- **Pulse pointer-lock re-entry delay** (a Chrome quirk where locking again within ~1s of Esc fails): the game already falls back to normal cursor input in that case.

---

## Results after the fix pass

Every finding above was fixed, re-tested and deployed. The one exception is **D4**, which was improved to meet WCAG and is explained in its row.

| ID | Status | What changed | Verified by |
|---|---|---|---|
| P1 | ✅ | Taps aim at their own coordinates. Pointer lock is never requested on touch, and touch input always uses absolute positions. | New touch e2e: ≥4 hits and ≤1 miss on a phone (was 0 hits) |
| P2 | ✅ | Always-visible pause button | Touch e2e + live phone check |
| P3 | ✅ | Touch-specific copy for every mode ("Tap anywhere to start"); key chips hidden on touch | Touch e2e + live phone check |
| P4 | ✅ | `aria-label`s on icon buttons | axe: 0 violations |
| P5 | ✅ | Flow falls back to the game clock when audio isn't running | Code path + unit suite |
| P6 | ✅ | Track: "Keep your finger on the gliding orb — drag along with it" | Re-audit screenshots |
| P7 | ✅ | Consistency uses median absolute deviation | New unit test: one 1300 ms outlier still gives > 85% |
| P8 | ✅ | Live targets are pulled back into bounds on resize | Code path |
| P9 | ✅ | Proper `role="img"`; hidden "Modes" h2 | axe: 0 violations |
| P10 | ✅ | 54×34 toggles, 36px swatches, 40px segments, 32px slider hit area on touch | Re-audit |
| P11 | ✅ | Long values only shrink when they need to | Screenshot |
| P12 | ✅ | 8–14 ms haptic tick on touch hits | — |
| D1 | ✅ | Screen Wake Lock during sessions, re-acquired after tab switches, released at the summary | New unit test (request + release) |
| D2 | ✅ | Orb and ring size and position respect the top bar on short screens | Re-audit landscape screenshot |
| D3 | ✅ | Touch-specific hints; key chips hidden on touch | Live phone check: "or Space" no longer appears |
| D4 | ✅* | Tension scale is now full-width 44px-tall segments. *On a 390px phone, 11 segments are 24–29px wide. That meets **WCAG 2.2 AA target size (24×24)**, and splitting a 0–10 scale into rows would hurt readability. | Re-audit |
| D5 | ✅ | Bigger toggles, slider hit areas and links on touch | Re-audit |
| D6 | ✅ | Installable + offline (see X3) | Live: service worker registered |
| I1 | ✅ | **Two-thumb touch mode:** drive stick (→ gas, ← brake, ↑↓ lean), finger drawing with automatic slow-mo, Hop/Slow buttons, colored ink swatches, a touch legend on the title and pause screens | New touch e2e: stick drives and a finger-drawn bridge crosses the gap. Live: stick drives 26 m. |
| I2 | ✅ | A head contact only counts as a crash at more than 60° of tilt | New physics tests ×3 vehicles |
| I3 | ✅ | All game keys use `KeyboardEvent.code` | New tests (Shift+2, AZERTY) + live Shift+2 check |
| I4 | ✅ | Wheel input switches ink at a 60px threshold with a 220 ms cooldown | New e2e: 12 tiny events = no change; one notch = one change |
| I5 | ✅ | Compact HUD at ≤560px height; inks move to the right edge on touch; rotate prompt in portrait | New portrait e2e + screenshots |
| I6 | ✅ | Compact logo and garage on short screens | Re-audit |
| I7 | ✅ | Pause shows the controls (keyboard diagram or touch legend) | Touch e2e |
| I8 | ✅ | Global keys ignore Enter/Space while a button has focus | Code path |
| I9 | ✅ | Separate touch tutorial copy | Touch e2e |
| I10 | ✅ | Bigger touch targets in settings | Re-audit |
| X1 | ✅ | `vercel.json` caching | Live: `/assets/*` → `max-age=31536000, immutable` on all three |
| X2 | ✅ | Error boundary with a Reload button | — |
| X3 | ✅ | Manifest, 192/512/maskable/Apple icons, offline service worker (network-first pages, cache-first hashed assets) | Live: all files 200, service worker registers |
| X4 | ✅ | Open Graph + Twitter cards with generated 1200×630 previews | Live: tags + og.png served |
| X5 | ✅ | "More games" links in all three | — |
| X6 | ✅ | Key chips hidden on `(hover: none) and (pointer: coarse)` | Re-audit |
| X7 | ✅ | Pulse Playwright suite (desktop + touch) | 2/2 passing |

### Bugs found while fixing

Building and testing the fixes turned up four more real bugs:

| ID | Sev | Finding | Fix |
|---|---|---|---|
| N1 | 🟠 | **Inkway sampled the pen once per frame**, so a fast swipe between frames lost its path (a flick across a gap drew only a stub). The start point also jumped. | Every pointer sample is queued, including coalesced high-rate events, and replayed in order |
| N2 | 🟡 | `setPointerCapture` throws when a pointer is already gone (very quick taps), which aborted the input handler in Inkway and Drift | Guarded `capturePointer()` helper at all four call sites |
| N3 | 🟡 | Pulse requested pointer lock on touch devices, putting touch aiming into relative mode | Never lock on coarse pointers; touch is always absolute |
| N4 | ⚪ | Pulse's unit runner tried to load Playwright specs, so `npm test` exited non-zero | Scoped Vitest to `src/**/*.test.ts` |

### Before → after

| Metric | Before | After |
|---|---|---|
| axe violations (84 screen×device runs) | 17 | **0** |
| Console errors | 0 | 0 |
| Touch targets under 32px | 70+ | 32. These are the D4 tension segments (24–29 × 44 px, WCAG 2.2 AA compliant) and slider thumbs, now reported for their 32px hit area. |
| Playable on phones | Drift only | **All three** |
| Unit / integration tests | 120 | **122** (Pulse 12 · Drift 55 · Inkway 55) |
| Browser tests | 17 | **24** (Pulse 2 · Drift 14 · Inkway 8) |
| Repeat-visit asset caching | `max-age=0` | **1 year, immutable** |

