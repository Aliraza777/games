import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

// Plays through every mode in headless Chrome using the dev-only window.__pulseEngine hook.
// Usage: npm run dev, then npm run smoke

const OUT = process.argv[2] ?? 'e2e/screenshots';
mkdirSync(OUT, { recursive: true });
const URL = process.env.PULSE_URL ?? 'http://localhost:5173/';
const errors = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const sleep = (ms) => page.waitForTimeout(ms);

/** Click every live target the engine knows about (dev hook). */
async function clickTargets(maxMs, opts = {}) {
  const end = Date.now() + maxMs;
  let clicks = 0;
  while (Date.now() < end) {
    const t = await page.evaluate((flow) => {
      const e = window.__pulseEngine;
      if (!e || e.state !== 'running') return { state: e?.state };
      if (flow) {
        const m = e.mode;
        const st = m.songTime;
        const n = m.notes.find((n) => !n.done && n.target && n.time - st < 0.03 && n.time - st > -0.1);
        return n ? { x: n.x, y: n.y, state: e.state } : { state: e.state };
      }
      const live = e.targets.find((t) => t.state === 'alive');
      return live ? { x: live.x, y: live.y, state: e.state } : { state: e.state };
    }, !!opts.flow);
    if (t.state === 'ended') break;
    if (t.x != null) {
      const jitter = opts.jitter ?? 4;
      await page.mouse.move(t.x + (Math.random() - 0.5) * jitter, t.y + (Math.random() - 0.5) * jitter);
      await page.mouse.down();
      await page.mouse.up();
      clicks++;
    }
    await sleep(opts.interval ?? 120);
  }
  return clicks;
}

await page.goto(URL);
await sleep(1500);
await shot('01-onboarding');
await page.click('.onboard-target');
await sleep(1200);
await shot('02-home');
await page.hover('.mode-card:nth-child(1)');
await sleep(600);
await shot('03-home-hover');
// Synthetic mouse events can't drive pointer lock — use absolute input for automation.
await page.click('text=Settings');
await sleep(800);
await page.click('[role="switch"][aria-label="Capture mouse"]');
await sleep(300);
await page.keyboard.press('Escape');
await sleep(800);

// Flick run
await page.click('.mode-card:nth-child(1)');
await sleep(1500);
await shot('04-flick-intro');
await page.keyboard.press('Space');
await sleep(1900);
const t0 = Date.now();
await clickTargets(4000);
await shot('05-flick-running');
const flickClicks = await clickTargets(40000);
const flickWall = (Date.now() - t0) / 1000;
await sleep(1500);
await shot('06-results');
await sleep(1500);
await shot('07-results-revealed');
const resultText = await page.textContent('.big-score');

// Pause flow: start retry, press Escape mid run
await page.keyboard.press('r');
await sleep(1200);
await page.keyboard.press('Space');
await sleep(2200);
await clickTargets(1500);
await page.keyboard.press('Escape');
await sleep(500);
await shot('08-paused');
await page.keyboard.press('Escape'); // quit
await sleep(800);

// Flow mode (rhythm)
await page.click('.mode-card:nth-child(5)');
await sleep(1500);
await page.keyboard.press('Space');
await sleep(1900);
const flowState = await page.evaluate(() => {
  const e = window.__pulseEngine;
  return { notes: e.mode.notes.length, songTime: e.mode.songTime, state: e.state };
});
await clickTargets(6000, { flow: true, interval: 15, jitter: 2 });
await shot('09-flow');
const flowMid = await page.evaluate(() => {
  const e = window.__pulseEngine;
  return { songTime: e.mode.songTime, hits: e.hits, misses: e.misses, combo: e.combo, score: e.score };
});
await page.keyboard.press('Escape');
await sleep(400);
await page.keyboard.press('Escape');
await sleep(800);

// Track mode, briefly
await page.click('.mode-card:nth-child(2)');
await sleep(1500);
await page.keyboard.press('Space');
await sleep(1900);
for (let i = 0; i < 80; i++) {
  const p = await page.evaluate(() => {
    const t = window.__pulseEngine.targets[0];
    return { x: t.x, y: t.y };
  });
  await page.mouse.move(p.x, p.y);
  await sleep(30);
}
await shot('10-track');
const trackState = await page.evaluate(() => ({ score: window.__pulseEngine.score, combo: window.__pulseEngine.combo }));
await page.keyboard.press('Escape');
await sleep(400);
await page.keyboard.press('Escape');
await sleep(800);

// Precision, briefly
await page.click('.mode-card:nth-child(3)');
await sleep(1500);
await page.keyboard.press('Space');
await sleep(1900);
await clickTargets(4000, { jitter: 1, interval: 250 });
await shot('10b-precision');
const precision = await page.evaluate(() => ({ hits: window.__pulseEngine.hits, score: window.__pulseEngine.score }));
await page.keyboard.press('Escape');
await sleep(400);
await page.keyboard.press('Escape');
await sleep(800);

// Reflex: one early click, then react to every target
await page.click('.mode-card:nth-child(4)');
await sleep(1500);
await page.keyboard.press('Space');
await sleep(1900);
await page.mouse.down();
await page.mouse.up();
const reflexClicks = await clickTargets(40000, { interval: 40 });
await sleep(2000);
await shot('10c-reflex-results');
const reflexResult = await page.textContent('.big-score');

await page.keyboard.press('Escape');
await sleep(800);
await page.click('text=Settings');
await sleep(1000);
await page.mouse.move(1200, 260);
await sleep(300);
await shot('11-settings');
await page.click('text=Deuteranopia');
await sleep(500);
await page.keyboard.press('Escape');
await sleep(900);
await shot('11b-home-deuteranopia');
await sleep(600);
await page.click('text=Stats');
await sleep(1200);
await shot('12-stats');

// Phone width
await page.setViewportSize({ width: 390, height: 844 });
await page.keyboard.press('Escape');
await sleep(800);
await shot('13-home-mobile');

console.log(JSON.stringify({ flickWall, precision, reflexClicks, reflexResult, flickClicks, resultText, flowState, flowMid, trackState, errors }, null, 2));
await browser.close();
