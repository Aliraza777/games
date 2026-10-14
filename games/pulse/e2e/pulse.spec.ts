import { expect, test, type Page } from '@playwright/test';

/** Live engine state through the dev-only hook. */
const engine = <T,>(page: Page, fn: string) => page.evaluate((f) => new Function('e', `return ${f}`)((window as any).__pulseEngine), fn) as Promise<T>;
const liveTarget = (page: Page) =>
  engine<{ x: number; y: number } | null>(page, "(t => t ? { x: t.x, y: t.y } : null)(e?.targets?.find(t => t.state === 'alive'))");

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\./.test(m.text()) && errors.push(m.text()));
  return errors;
}

async function toHome(page: Page, tap: boolean) {
  await page.goto('/');
  const target = page.locator('.onboard-target');
  tap ? await target.tap() : await target.click();
  await expect(page.getByRole('region', { name: 'Modes' })).toBeVisible();
}

test('desktop: flick run, pause button, results @desktop', async ({ page }) => {
  const errors = watchErrors(page);
  await toHome(page, false);
  // Headless Chrome can't drive pointer lock with synthetic moves — use the normal cursor.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Capture mouse' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Play Flick/ }).click();
  await expect(page.getByText(/click anywhere or press/i)).toBeVisible();
  await page.locator('.run-intro').click();
  await page.waitForTimeout(2200);
  for (let i = 0; i < 6; i++) {
    const t = await liveTarget(page);
    if (t) await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(120);
  }
  expect(await engine<number>(page, 'e.hits')).toBeGreaterThanOrEqual(4);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: /resume/i }).click();
  await page.waitForTimeout(2200);
  await engine(page, '(e.time = 1e6)');
  await expect(page.getByText('Score', { exact: true })).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('touch: taps hit targets, copy speaks touch, pause is reachable @mobile', async ({ page }) => {
  const errors = watchErrors(page);
  await toHome(page, true);
  await page.getByRole('button', { name: /^Play Flick/ }).tap();
  await expect(page.getByText('Tap anywhere to start')).toBeVisible();
  await expect(page.getByText(/mouse is captured/i)).toBeHidden();
  await page.locator('.run-intro').tap();
  await page.waitForTimeout(2200);
  for (let i = 0; i < 6; i++) {
    const t = await liveTarget(page);
    if (t) await page.touchscreen.tap(t.x, t.y);
    await page.waitForTimeout(150);
  }
  // QA P1: before the fix every tap scored as a miss.
  expect(await engine<number>(page, 'e.hits')).toBeGreaterThanOrEqual(4);
  expect(await engine<number>(page, 'e.misses')).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'Pause' }).tap();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: /quit/i }).tap();
  await expect(page.getByRole('region', { name: 'Modes' })).toBeVisible();
  expect(errors).toEqual([]);
});
