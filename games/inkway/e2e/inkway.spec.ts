import { expect, test, type Page } from '@playwright/test';

type Vec = { x: number; y: number };
const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png` });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** Read live game state through the dev-only hook. */
const vehicleX = (page: Page) => page.evaluate(() => (window as any).__inkway.vehicle().x as number);
const gapAhead = (page: Page) => page.evaluate(() => (window as any).__inkway.nextGap() as { from: Vec; to: Vec; kind: string });
const toScreen = (page: Page, p: Vec) =>
  page.evaluate((p) => {
    const g = (window as any).__inkway;
    const s = g.worldToScreen(p);
    const r = (document.querySelector('[data-testid="game"]') as HTMLElement).getBoundingClientRect();
    return { x: s.x + r.left, y: s.y + r.top };
  }, p);

/** Draw a straight line between two world points with the real mouse, re-aiming as the camera moves. */
async function drawWorldLine(page: Page, a: Vec, b: Vec, steps = 18) {
  let p = await toScreen(page, a);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    p = await toScreen(page, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    await page.mouse.move(p.x, p.y, { steps: 2 });
  }
  await page.mouse.up();
}

test('title: attract mode plays itself and the garage responds to keys', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Inkway' })).toBeVisible();
  const cards = page.getByRole('radiogroup', { name: 'Vehicle' }).getByRole('radio');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(1)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(cards.nth(0)).toHaveAttribute('aria-checked', 'true');

  // The background canvas really renders (not a blank fill).
  await page.waitForTimeout(2500);
  const colors = await page.evaluate(() => {
    const c = document.querySelector('canvas.attract') as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const d = ctx.getImageData(((i * 97) % c.width), ((i * 53) % c.height), 1, 1).data;
      seen.add(`${d[0] >> 4},${d[1] >> 4},${d[2] >> 4}`);
    }
    return seen.size;
  });
  expect(colors).toBeGreaterThan(5);
  await shot(page, '01-title');
  expect(errors).toEqual([]);
});

test('ride: drive with the keyboard, draw a bridge with the mouse, cross the gap', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Hold W to roll')).toBeVisible();
  await expect(page.getByText('Hold W or ↑ to drive')).toBeVisible();
  await shot(page, '02-ready');

  await page.keyboard.down('w');
  const gap = await gapAhead(page);
  // Wait for the tutorial to slow time and show the ghost line.
  await expect(page.getByText(/gap ahead! hold the mouse/i)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await shot(page, '03-gap-hint');

  await drawWorldLine(page, { x: gap.from.x - 1.5, y: gap.from.y + 0.1 }, { x: gap.to.x + 1.5, y: gap.to.y + 0.1 });
  await shot(page, '04-bridge-drawn');
  await expect.poll(() => vehicleX(page), { timeout: 15_000 }).toBeGreaterThan(gap.to.x + 3);
  await expect(page.getByText(/gap ahead/i)).toBeHidden();
  const dist = Number((await page.getByTestId('distance').textContent())!.replace(/\D/g, ''));
  expect(dist).toBeGreaterThan(gap.to.x - 10);
  await shot(page, '05-crossed');

  // Switch inks with the keyboard and see the HUD follow.
  await page.keyboard.press('2');
  await expect(page.getByTestId('ink-bounce')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('3');
  await expect(page.getByTestId('ink-boost')).toHaveAttribute('aria-checked', 'true');

  // Lay boost ink ahead on the ground and enjoy the speed.
  const x = await vehicleX(page);
  const ground = await page.evaluate((x) => {
    const g = (window as any).__inkway;
    const p = g.platforms.find((p: any) => p.x0 <= x + 6 && p.x1 >= x + 16);
    return p ? p.points.find((q: Vec) => q.x >= x + 6).y : null;
  }, x);
  if (ground != null) {
    await drawWorldLine(page, { x: x + 6, y: ground + 0.1 }, { x: x + 16, y: ground + 0.1 }, 10);
    await page.waitForTimeout(400);
    await shot(page, '06-boost');
  }
  await page.keyboard.up('w');
  expect(errors).toEqual([]);
});

test('pause, crash into the void, game over, retry, records', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const frozen = await vehicleX(page);
  await page.waitForTimeout(500);
  expect(await vehicleX(page)).toBeCloseTo(frozen, 3);
  await shot(page, '07-paused');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden();

  // No bridge: straight into the first gap.
  await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.up('w');
  await expect(page.getByRole('heading', { name: 'Swallowed by the void' })).toBeVisible();
  const score = Number((await page.getByTestId('final-score').textContent())!.replace(/\D/g, ''));
  expect(score).toBeGreaterThan(20);
  await page.waitForTimeout(700);
  await shot(page, '08-game-over');

  await page.keyboard.press('r');
  await expect(page.getByTestId('game-over')).toBeHidden();
  await expect(page.getByTestId('distance')).toContainText('0');

  await page.keyboard.press('Escape'); // pause
  await page.getByRole('button', { name: 'Garage' }).click();
  await expect(page.getByRole('radio', { name: /^Car:/ })).toContainText(`Best ${score.toLocaleString('en-US')}`);
  expect(errors).toEqual([]);
});

test('settings sheet @mobile', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  if (test.info().project.name === 'mobile') {
    await expect(page.getByText(/needs a keyboard and a mouse/i)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('switch', { name: 'Music' }).click();
  await expect(dialog.getByRole('switch', { name: 'Music' })).toHaveAttribute('aria-checked', 'false');
  await shot(page, '09-settings');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('inkway-settings')!).state.musicOn);
  expect(stored).toBe(false);
  await shot(page, '10-title-after');
  expect(errors).toEqual([]);
});
