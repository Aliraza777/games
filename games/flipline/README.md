# Flipline

*Hold to ride. Hold to flip. Land clean.* A one-button neon stunt bike game. It recreates the gameplay of Ketchapp's *Rider* with original code, art, sound and levels (no Ketchapp branding or assets). See [plan.md](plan.md).

```bash
npm run dev -- flipline   # from the repo root
npm test                  # flips, levels (every level finishable from every checkpoint), physics, screens
npm run e2e               # Playwright: desktop, phone landscape (touch), phone menus
```

- **One button:** hold the mouse, a finger or any key. On the ground it drives the rear wheel; in the air it spins you backwards; release and the spin stops.
- **Scoring:** land on your wheels. Flips score and give a speed burst, and a near-flat **perfect** landing adds a bonus. Your helmet touching the track is a crash: tap to respawn at the last checkpoint.
- **12 levels:** hills, kickers, gaps, drops and **loop-de-loops**. Loops are one-sided and switch off after a lap, so you roll out cleanly.
- **Gems and bikes:** 3 gems per level, placed on the riding line so every one is collectible. Gems unlock 8 cosmetic bikes.

Tested headlessly: a careful bot finishes every level from the start and from every checkpoint, a flip bot lands real backflips, and every gem is reachable.
