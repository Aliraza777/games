import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png` });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\./.test(m.text()) && errors.push(m.text()));
  return errors;
}

type Active = { type: string; rot: number; x: number; y: number } | null;
const active = (page: Page) => page.evaluate(() => window.__stackfall?.engine()?.active ?? null) as Promise<Active>;
const engineState = (page: Page) => page.evaluate(() => {
  const e = window.__stackfall?.engine();
  return e ? { state: e.state, lines: e.stats.lines, pieces: e.stats.pieces, hold: e.hold } : { state: 'none', lines: 0, pieces: -1, hold: null };
});

async function startMode(page: Page, card: RegExp) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('stackfall-progress', JSON.stringify({ state: { tutorialDone: true }, version: 1 })));
  await page.reload();
  await page.locator('.mode-card', { hasText: card }).click();
  await expect.poll(async () => (await engineState(page)).state, { timeout: 5000 }).toBe('playing');
}

/** Play like a person on a keyboard: rotate, slide, hard drop. */
async function botPiece(page: Page) {
  const p = await active(page);
  if (!p) return page.waitForTimeout(30);
  const plan = await page.evaluate(() => {
    const e = window.__stackfall!.engine()!;
    const r = window.__stackfall!.plan(e.board, e.active!.type)!;
    return { rot: r.rot, x: r.x };
  });
  for (let i = 0; i < plan.rot; i++) await page.keyboard.press('ArrowUp');
  const x = (await active(page))!.x;
  for (let i = 0; i < Math.abs(plan.x - x); i++) await page.keyboard.press(plan.x < x ? 'ArrowLeft' : 'ArrowRight');
  await page.keyboard.press('Space');
}

test('first run shows the tutorial, then counts down @desktop', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stackfall' })).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, '01-title');
  await page.getByRole('button', { name: /Play Marathon/ }).click();
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible();
  await shot(page, '02-tutorial');
  await page.getByRole('button', { name: "Let's go" }).click();
  await expect.poll(async () => (await engineState(page)).state, { timeout: 5000 }).toBe('playing');
  expect(errors).toEqual([]);
});

test('a keyboard bot clears a 40-line Sprint; Enter plays again @desktop', async ({ page }) => {
  const errors = watchErrors(page);
  await startMode(page, /Sprint/);
  for (let i = 0; i < 160; i++) {
    if ((await engineState(page)).state !== 'playing') break;
    await botPiece(page);
    if (i === 40) await shot(page, '03-sprint');
  }
  await expect(page.getByRole('dialog', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('Finished!')).toBeVisible();
  await expect(page.getByTestId('result-main')).toHaveText(/^\d:\d\d\.\d\d$/);
  await expect(page.getByText('FIRST RECORD SET')).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, '04-results');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await engineState(page)).pieces, { timeout: 5000 }).toBe(0);
  await expect.poll(async () => (await engineState(page)).state, { timeout: 5000 }).toBe('playing');
  expect(errors).toEqual([]);
});

test('pause, settings, quit to menu @desktop', async ({ page }) => {
  await startMode(page, /Marathon/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  expect((await engineState(page)).state).toBe('paused');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await shot(page, '05-settings');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Quit to menu/ }).click();
  await expect(page.getByRole('button', { name: /Play Marathon/ })).toBeVisible();
});

test('touch gestures: tap rotates, drag moves, swipe up holds, flick drops @touch', async ({ page }) => {
  const errors = watchErrors(page);
  await startMode(page, /Marathon/);
  await page.waitForTimeout(300);
  const box = (await page.locator('.well-wrap').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.55;
  const cell = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.play')!).getPropertyValue('--cell')));
  const touch = (pts: { x: number; y: number }[], stepMs = 16) =>
    page.evaluate(
      async ({ pts, stepMs }) => {
        const el = document.querySelector('.well-wrap')!;
        const ev = (type: string, p: { x: number; y: number }) =>
          el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: p.x, clientY: p.y, bubbles: true, isPrimary: true }));
        ev('pointerdown', pts[0]);
        for (const p of pts.slice(1)) {
          await new Promise((r) => setTimeout(r, stepMs));
          ev('pointermove', p);
        }
        ev('pointerup', pts[pts.length - 1]);
      },
      { pts, stepMs },
    );

  const before = (await active(page))!;
  await touch([{ x: cx, y: cy }]);
  expect((await active(page))!.rot).toBe((before.rot + 1) % 4);

  const x0 = (await active(page))!.x;
  await touch([0, 1, 2, 3].map((i) => ({ x: cx - i * cell, y: cy })), 30);
  expect((await active(page))!.x).toBeLessThan(x0);

  const cur = (await active(page))!.type;
  await touch([0, 1, 2, 3, 4].map((i) => ({ x: cx, y: cy - i * cell * 0.8 })), 20);
  expect((await engineState(page)).hold).toBe(cur);

  const pieces = (await engineState(page)).pieces;
  await touch([0, 1, 2, 3].map((i) => ({ x: cx, y: cy - 80 + i * cell * 2.5 })), 8);
  expect((await engineState(page)).pieces).toBe(pieces + 1);
  await shot(page, '06-touch-play');
  expect(errors).toEqual([]);
});

test('phone menus and on-screen buttons @phone', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(800);
  await shot(page, '07-phone-title');
  await page.evaluate(() =>
    localStorage.setItem('stackfall-progress', JSON.stringify({ state: { tutorialDone: true, settings: { touchButtons: true } }, version: 1 })),
  );
  await page.reload();
  await page.locator('.mode-card', { hasText: /Zen/ }).click();
  await expect.poll(async () => (await engineState(page)).state, { timeout: 5000 }).toBe('playing');
  const pieces = (await engineState(page)).pieces;
  await page.locator('.a-hardDrop').tap();
  expect((await engineState(page)).pieces).toBe(pieces + 1);
  for (let i = 0; i < 8; i++) await page.locator('.a-hardDrop').tap();
  await page.waitForTimeout(200);
  await shot(page, '08-phone-play');
  // Every control is visible without scrolling.
  const pad = (await page.locator('.touchpad').boundingBox())!;
  expect(pad.y + pad.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
});
