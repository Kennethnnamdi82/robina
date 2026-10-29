import { expect, test, type Page } from '@playwright/test';

const entry = '/tests/rivals/index.html';
test.beforeEach(({ page }) => {
  page.on('pageerror', error => console.error('Browser error:', error.message));
  page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
});
const position = async (page: Page) => page.getByTestId('arena-position').evaluate(element => ({ x: Number(element.getAttribute('data-x')), y: Number(element.getAttribute('data-y')), cameraX: Number(element.getAttribute('data-camera-x')), cameraY: Number(element.getAttribute('data-camera-y')), collisions: Number(element.getAttribute('data-collisions')) }));
const enter = async (page: Page) => { await page.getByRole('button', { name: 'ENTER THE ARENA' }).click(); await expect(page.locator('.rivals-game-view')).toHaveAttribute('data-status', 'playing', { timeout: 90000 }); };
const hold = async (page: Page, key: string, ms: number) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(160); };

test('lobby uses real controls, a field guide, and no eager game engine', async ({ page }, testInfo) => {
  const engineRequests: string[] = [];
  page.on('request', request => { if (/phaser|createGame/.test(request.url())) engineRequests.push(request.url()); });
  await page.goto(entry);
  await expect(page.getByRole('heading', { name: 'Welcome to the Arena.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ENTER THE ARENA' })).toBeVisible();
  await page.getByRole('button', { name: /Field guide/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'UNDERSTOOD' }).click();
  expect(engineRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('lobby-desktop.png'), fullPage: true });
});

test('real keyboard movement hits cover and walls and camera tracks', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(entry); await enter(page);
  const start = await position(page);
  await page.keyboard.down('d');
  await expect.poll(async () => (await position(page)).x, { timeout: 20000 }).toBeGreaterThan(420);
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  const cover = await position(page);
  expect(cover.x).toBeGreaterThan(start.x + 90);
  expect(cover.x).toBeLessThan(452); // Supplied crate has a real static body.
  await page.keyboard.down('a');
  await expect.poll(async () => (await position(page)).x, { timeout: 20000 }).toBeLessThan(90);
  await page.keyboard.up('a');
  const wall = await position(page);
  expect(wall.x).toBeGreaterThanOrEqual(77);
  expect(wall.x).toBeLessThan(90);
  expect(wall.collisions).toBeGreaterThan(0);
  await page.keyboard.down('s');
  await expect.poll(async () => (await position(page)).y, { timeout: 20000 }).toBeGreaterThan(start.y + 300);
  await page.keyboard.up('s');
  await expect.poll(async () => (await position(page)).cameraY).toBeGreaterThan(20);
  expect(errors).toEqual([]);
  // Capture the insertion area, with the operative visible rather than at a test boundary.
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'RETURN TO LOBBY', exact: true }).click();
  await enter(page);
  await page.waitForTimeout(650);
  await page.screenshot({ path: testInfo.outputPath('arena-desktop.png') });
});

test('pause freezes physics and timer, resume works, and repeated exits clean up', async ({ page }) => {
  await page.goto(entry); await enter(page);
  await hold(page, 's', 250);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  const before = await position(page), time = await page.getByLabel('Session time').textContent();
  await hold(page, 'd', 1200);
  expect(await position(page)).toEqual(before);
  expect(await page.getByLabel('Session time').textContent()).toBe(time);
  await page.getByRole('button', { name: 'RESUME RECON' }).click();
  await page.keyboard.down('s');
  await expect.poll(async () => (await position(page)).y, { timeout: 10000 }).toBeGreaterThan(before.y + 40);
  await page.keyboard.up('s');
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
    await page.getByRole('button', { name: 'RETURN TO LOBBY', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await enter(page);
    await expect(page.locator('canvas')).toHaveCount(1);
  }
});

test('focus loss pauses safely and supports explicit audio control', async ({ page }) => {
  await page.goto(entry); await enter(page);
  await page.getByRole('button', { name: 'Enable ambient audio' }).click();
  await expect(page.getByRole('button', { name: 'Mute ambient audio' })).toBeVisible();
  await page.getByRole('button', { name: 'Mute ambient audio' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.rivals-game-view')).toHaveAttribute('data-status', 'playing');
});

test('asset failure produces a recoverable screen, then retry creates a working scene', async ({ page }) => {
  await page.route('**/assets/rivals/phase02/neon-floor.webp*', route => route.abort());
  await page.goto(entry); await page.getByRole('button', { name: 'ENTER THE ARENA' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to load', { timeout: 90000 });
  await page.getByRole('button', { name: 'RETURN & RETRY' }).click();
  await page.unroute('**/assets/rivals/phase02/neon-floor.webp*');
  await enter(page);
});

test('mobile touch movement, pointer cancellation, pause, and responsive resize', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${testInfo.project.use.baseURL}${entry}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('lobby-mobile.png'), fullPage: true });
  await enter(page);
  const stick = page.getByTestId('movement-stick');
  const bounds = (await stick.boundingBox())!;
  const start = await position(page);
  const cdp = await context.newCDPSession(page);
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 38 }] });
  await expect.poll(async () => (await position(page)).y, { timeout: 20000 }).toBeGreaterThan(start.y + 45);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  const moved = await position(page);
  expect(moved.y).toBeGreaterThan(start.y + 45);
  await page.waitForTimeout(200); const stopped = await position(page);
  await page.waitForTimeout(400); expect((await position(page)).y).toBeCloseTo(stopped.y, 0);
  await page.screenshot({ path: testInfo.outputPath('arena-mobile.png') });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'RESUME RECON' })).toBeVisible();
  await page.getByRole('button', { name: 'RESUME RECON' }).tap();
  const canvas = (await page.locator('canvas').boundingBox())!;
  expect(canvas.width).toBe(844);
  expect(canvas.height).toBeLessThanOrEqual(390);
  await context.close();
});
