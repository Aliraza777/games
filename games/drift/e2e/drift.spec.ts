import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end: real browser, real canvas, real audio graph. `?speed=N` fast-forwards
 * session time (dev only) so a full practice finishes in seconds.
 */

const shots = (page: Page, name: string) =>
  page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png` });

/** Fail the test on any uncaught error or console error. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Google Fonts may be blocked offline; that's not an app error.
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function skipIntro(page: Page, query = '') {
  await page.goto(`/${query}`);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('region', { name: 'Practices' })).toBeVisible();
}

async function stageCenter(page: Page) {
  const box = (await page.getByTestId('stage').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('first breath: hold, let go, and you are in', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?speed=3');
  await expect(page.getByText('Press and hold anywhere as you breathe in.')).toBeVisible();
  await shots(page, '01-intro');

  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.down();
  await expect(page.getByText('Now let go, and breathe out slowly.')).toBeVisible({ timeout: 10_000 });
  await shots(page, '02-intro-full');
  await page.mouse.up();
  await expect(page.getByText('That’s it. That’s the whole game.')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/good|still|winding/i);
  await shots(page, '03-home');

  // Onboarding is remembered.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Practices' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a full Sigh session, breathing along with the guide', async ({ page }) => {
  const errors = watchErrors(page);
  await skipIntro(page, '?speed=10');

  await page.getByRole('button', { name: /^Sigh:/ }).click();
  const dialog = page.getByRole('dialog', { name: /set up sigh/i });
  await dialog.getByRole('radio', { name: '1 min' }).click();
  await dialog.getByRole('radio', { name: 'Hold to breathe' }).click();
  await dialog.getByRole('radio', { name: /^7/ }).click();
  await shots(page, '04-setup');
  await dialog.getByRole('button', { name: /begin · 1 min/i }).click();

  const stage = page.getByTestId('stage');
  await expect(stage).toBeVisible();
  const c = await stageCenter(page);
  await page.mouse.move(c.x, c.y);

  // Follow the cue: hold while breathing in (and the extra sip), release to exhale.
  let held = false;
  let tookShot = false;
  const summary = page.getByTestId('summary');
  while (!(await summary.isVisible())) {
    const phase = await stage.getAttribute('data-phase');
    const want = phase === 'inhale' || phase === 'topup' || phase === 'hold';
    if (want && !held) await page.mouse.down();
    if (!want && held) await page.mouse.up();
    held = want;
    if (!tookShot && phase === 'exhale') {
      const t = await page.getByLabel('Time remaining').textContent();
      if (t && t < '0:30') {
        await shots(page, '05-sigh-session');
        tookShot = true;
      }
    }
    await page.waitForTimeout(15);
  }
  if (held) await page.mouse.up();

  // Check-out, then results.
  await expect(page.getByText('How tense do you feel now?')).toBeVisible();
  await page.getByRole('radio', { name: /^3$/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Well done.')).toBeVisible();
  await expect(page.getByTestId('tension-result')).toContainText(/7\s*→\s*3/);
  const rhythm = await page.locator('.summary-stats div', { hasText: 'In rhythm' }).locator('dd').textContent();
  expect(parseInt(rhythm!)).toBeGreaterThanOrEqual(80);
  await expect(page.locator('.summary-stats div', { hasText: 'Slow breaths' }).locator('dd')).toHaveText('7');
  await page.waitForTimeout(1200);
  await shots(page, '06-summary');

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('1 day in a row')).toBeVisible();
  await page.getByRole('button', { name: /journey/i }).click();
  await expect(page.locator('.tile', { hasText: 'Sessions' })).toContainText('1');
  await expect(page.locator('.tile', { hasText: 'Avg tension change' })).toContainText('−4.0');
  await shots(page, '07-journey');
  expect(errors).toEqual([]);
});

test('Count: nine breaths close a circle; drifting is welcomed', async ({ page }) => {
  const errors = watchErrors(page);
  await skipIntro(page, '?speed=20');
  await page.getByRole('button', { name: /^Count:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /begin/i }).click();
  await expect(page.getByTestId('count')).toHaveText('Begin at one');

  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(80); // ≥ one breath of session time
    await page.keyboard.press('Space');
    await expect(page.getByTestId('count')).toHaveText(`${i} of 9`);
  }
  await shots(page, '08-count-eight');
  await page.waitForTimeout(80);
  await page.keyboard.down('Space');
  await page.waitForTimeout(150); // hold → close the circle
  await page.keyboard.up('Space');
  await expect(page.getByRole('status')).toContainText('Circle closed');
  await expect(page.getByTestId('count')).toHaveText('Begin at one');

  await page.waitForTimeout(80);
  await page.keyboard.press('Space');
  await page.keyboard.press('d');
  await expect(page.getByRole('status')).toContainText('Noticing you drifted is the practice');

  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('.summary-stats div', { hasText: 'Circles closed' }).locator('dd')).toHaveText('1');
  await expect(page.locator('.summary-stats div', { hasText: 'Counting accuracy' }).locator('dd')).toHaveText('100%');
  await expect(page.getByText(/noticed your mind wander 1 time/)).toBeVisible();
  await shots(page, '09-count-summary');
  expect(errors).toEqual([]);
});

test('Pond: dragging across the water makes ripples and music', async ({ page }) => {
  const errors = watchErrors(page);
  await skipIntro(page);
  await page.getByRole('button', { name: /^Pond:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /begin/i }).click();
  const stage = page.getByTestId('stage');
  const box = (await stage.boundingBox())!;
  const y = box.y + box.height * 0.7;
  await page.mouse.move(box.x + box.width * 0.15, y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(box.x + box.width * (0.15 + i * 0.035), y + Math.sin(i / 3) * 40);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  const ripples = Number(await stage.getAttribute('data-ripples'));
  expect(ripples).toBeGreaterThan(5);
  await page.waitForTimeout(700);
  await shots(page, '10-pond');
  // Mouse still → chrome fades; any movement brings it back.
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.getByRole('button', { name: 'I’m done' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('.summary-stats div', { hasText: 'Ripples' }).locator('dd')).toHaveText(String(ripples));
  expect(errors).toEqual([]);
});

test('pausing on blur, settings themes, and no horizontal overflow', async ({ page }) => {
  const errors = watchErrors(page);
  await skipIntro(page);

  const noOverflow = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await noOverflow();

  await page.getByRole('button', { name: /^Tide:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /begin/i }).click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await shots(page, '11-paused');
  await page.getByRole('button', { name: 'Leave without saving' }).click();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: /ember/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ember');
  await noOverflow();
  await shots(page, '12-settings-ember');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Practices' })).toBeVisible();
  await noOverflow();
  await shots(page, '13-home-ember');
  expect(errors).toEqual([]);
});

test('respects reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-rm', 'on');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('region', { name: 'Practices' })).toBeVisible();
  const anim = await page.locator('.aurora').first().evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('Box breathing reaches its "rest" phase and keeps cycling; "Again" starts fresh', async ({ page }) => {
  const errors = watchErrors(page);
  await skipIntro(page, '?speed=8');
  await page.getByRole('button', { name: /^Box:/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: '2 min' }).click();
  await dialog.getByRole('radio', { name: 'Just follow' }).click();
  await dialog.getByRole('button', { name: /begin/i }).click();
  const stage = page.getByTestId('stage');

  // inhale → hold → exhale → rest → inhale again
  const seen: string[] = [];
  for (let i = 0; i < 400 && seen.join(',') !== 'inhale,hold,exhale,rest,inhale'; i++) {
    const p = await stage.getAttribute('data-phase');
    if (p && seen[seen.length - 1] !== p) seen.push(p);
    await page.waitForTimeout(20);
  }
  expect(seen).toEqual(['inhale', 'hold', 'exhale', 'rest', 'inhale']);
  await expect(page.getByTestId('cue')).toHaveText('Breathe in');

  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /skip|continue/i }).click();
  await page.getByRole('button', { name: 'Again' }).click();
  await expect(page.getByTestId('summary')).toBeHidden();
  await expect(page.getByLabel('Time remaining')).toHaveText(/^[12]:\d\d$/);
  await expect(page.getByTestId('stage')).toHaveAttribute('data-phase', /inhale|hold/);
  expect(errors).toEqual([]);
});
