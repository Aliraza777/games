import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png` });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\./.test(m.text()) && errors.push(m.text()));
  return errors;
}

type Bike = { grounded: boolean; angle: number; x: number };
const bike = (page: Page) => page.evaluate(() => {
  const b = (window as any).__flipline.bike;
  return { grounded: b.grounded, angle: b.angle, x: b.x } as Bike;
});
const careful = (b: Bike) => b.grounded || Math.atan2(Math.sin(b.angle), Math.cos(b.angle)) < -0.12;

/** Ride with one real button (mouse), like a careful human, until `stop` is true. */
async function rideWithMouse(page: Page, stop: () => Promise<boolean>, maxMs = 60_000) {
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height * 0.7);
  let held = false;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await stop()) break;
    const want = careful(await bike(page));
    if (want && !held) await page.mouse.down();
    if (!want && held) await page.mouse.up();
    held = want;
  }
  if (held) await page.mouse.up();
}

test('play level 1 start to finish with one button @desktop', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FLIPLINE' })).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, '01-title');
  await page.getByRole('button', { name: /play level 1/i }).click();
  await expect(page.getByText('Hold the mouse or any key to ride')).toBeVisible();
  await expect(page.getByText('Hold to ride')).toBeVisible(); // tutorial hint
  await shot(page, '02-ready');

  const finish = page.getByTestId('finish');
  let mid = false;
  await rideWithMouse(page, async () => {
    if (!mid && (await bike(page)).x > 60) {
      mid = true;
      await shot(page, '03-riding');
    }
    return finish.isVisible();
  });
  await expect(finish).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First Light complete!' })).toBeVisible();
  await expect(page.getByLabel('3 of 3 gems')).toBeVisible();
  await page.waitForTimeout(700);
  await shot(page, '04-finish');

  await page.getByRole('button', { name: 'Next level' }).click();
  await expect(page.getByText(/2\. drop in/i)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Levels' }).click();
  await expect(page.getByRole('button', { name: /level 1: first light, done, 3 of 3 gems/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /level 2: drop in$/i })).toBeEnabled();
  await shot(page, '05-levels');
  expect(errors).toEqual([]);
});

test('crash, then a fresh key press retries from the checkpoint @desktop', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /play level 1/i }).click();
  await expect(page.getByText('Hold the mouse or any key to ride')).toBeVisible();
  // Ride past the first checkpoint, then tip the bike onto its helmet (dev hook) — a guaranteed crash.
  await rideWithMouse(page, async () => (await page.evaluate(() => (window as any).__flipline.checkpoint)) >= 1);
  await page.evaluate(() => {
    const g = (window as any).__flipline;
    const c = g.physics.chassis;
    const p = c.getPosition();
    c.setTransform({ x: p.x, y: p.y + 1.5 }, Math.PI);
  });
  await expect(page.getByTestId('retry')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('retry')).toHaveText(/press any key to retry/i, { timeout: 5000 });
  await shot(page, '06-crash');
  await page.keyboard.press('KeyJ');
  await expect(page.getByText('Hold the mouse or any key to ride')).toBeVisible();
  // Respawned at checkpoint 1, not the start.
  const back = await page.evaluate(() => { const g = (window as any).__flipline; return { x: g.bike.x, cp: g.level.checkpoints[1].x, idx: g.checkpoint }; });
  expect(back.idx).toBe(1);
  expect(Math.abs(back.x - back.cp)).toBeLessThan(1.5);
  expect(errors).toEqual([]);
});

test('pause button and Esc @desktop', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /play level 1/i }).click();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const x = (await bike(page)).x;
  await page.waitForTimeout(400);
  expect((await bike(page)).x).toBeCloseTo(x, 4);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden();
  await page.keyboard.up('KeyD');
});

test('touch: tap to play, hold to ride @touch', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /play level 1/i }).tap();
  await expect(page.getByText('Hold anywhere to ride')).toBeVisible();
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height * 0.7);
  await page.mouse.down();
  await expect.poll(async () => (await bike(page)).x, { timeout: 10_000 }).toBeGreaterThan(25);
  await page.mouse.up();
  await shot(page, '07-touch-ride');
  await page.getByRole('button', { name: 'Pause' }).tap();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('menus on a phone @phone', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByText('Tap to play')).toBeVisible();
  await shot(page, '08-title-phone');
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  expect(await noOverflow()).toBe(true);
  await page.getByRole('button', { name: /levels/i }).tap();
  await expect(page.getByRole('heading', { name: 'Levels' })).toBeVisible();
  expect(await noOverflow()).toBe(true);
  await shot(page, '09-levels-phone');
  await page.getByRole('button', { name: '← Back' }).tap();
  await page.getByRole('button', { name: /garage/i }).tap();
  await expect(page.getByRole('radio', { name: 'Spark' })).toHaveAttribute('aria-checked', 'true');
  await shot(page, '10-garage-phone');
  expect(errors).toEqual([]);
});

test('holding straight through the menu transition still rides @desktop', async ({ page }) => {
  await page.goto('/');
  const play = page.getByRole('button', { name: /play level 1/i });
  await expect(play).toBeVisible();
  const box = (await play.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // Press Play and keep holding — no second press.
  await page.mouse.down();
  await expect.poll(async () => Number(await page.getByRole('progressbar', { name: 'Level progress' }).getAttribute('aria-valuenow')), { timeout: 10_000 }).toBeGreaterThan(3);
  await page.mouse.up();
});
