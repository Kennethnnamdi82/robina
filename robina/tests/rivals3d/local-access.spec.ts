import { expect, test } from '@playwright/test';
import { networkInterfaces } from 'node:os';

test('local entry routes open the sandbox in a fresh browser without authentication', async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  for (const entry of ['/', '/index.html', '/gaming', '/gaming/', '/login']) {
    await page.goto(entry);
    await expect(page.getByRole('button', { name: 'ENTER 3D RAID' })).toBeVisible();
    await expect(page).toHaveURL(/\/tests\/rivals3d\/index\.html$/);
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  expect(requests.filter(url => /privy|walletconnect|accounts\.google|\/src\/main\.tsx|\/api\//i.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});

test('HTTP LAN address renders and plays in desktop and phone Chrome without secure-context APIs', async ({ browser }, info) => {
  test.setTimeout(180000);
  const address = Object.values(networkInterfaces()).flat().find(item => item?.family === 'IPv4' && !item.internal)?.address;
  test.skip(!address, 'A private network interface is required for this LAN-origin regression.');
  const url = new URL(String(info.project.use.baseURL));
  url.hostname = address!;
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      const authRequests: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/privy|walletconnect|accounts\.google|\/api\//i.test(request.url())) authRequests.push(request.url()); });
      await page.goto(url.href);
      expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
      expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('undefined');
      await expect(page.getByRole('button', { name: 'ENTER 3D RAID' })).toBeVisible();
      await page.screenshot({ path: info.outputPath(mobile ? 'lan-phone-lobby.png' : 'lan-desktop-lobby.png') });
      await page.getByRole('button', { name: 'ENTER 3D RAID' }).click();
      await expect(page.locator('.r3-game')).toHaveAttribute('data-status', 'playing', { timeout: 90000 });
      await expect(page.getByTestId('three-state')).toHaveAttribute('data-run', /^[0-9a-f-]{36}$/);
      await expect(page.locator('canvas')).toHaveCount(1);
      if (mobile) await expect(page.getByTestId('movement-stick')).toBeVisible();
      await page.screenshot({ path: info.outputPath(mobile ? 'lan-phone-raid.png' : 'lan-desktop-raid.png') });
      await page.getByRole('button', { name: 'Pause game', exact: true }).click();
      await page.getByRole('button', { name: 'RESTART 3D RAID' }).click();
      await expect(page.locator('.r3-game')).toHaveAttribute('data-status', 'playing', { timeout: 90000 });
      await page.getByRole('button', { name: 'Pause game', exact: true }).click();
      await page.getByRole('button', { name: 'EXIT SANDBOX' }).click();
      await expect(page.locator('canvas')).toHaveCount(0);
      expect(errors).toEqual([]);
      expect(authRequests).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

test('phone entry starts a playable raid without login or wallet services', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    const requests: string[] = [];
    const errors: string[] = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(String(info.project.use.baseURL) + '/');
    await page.getByRole('button', { name: 'ENTER 3D RAID' }).tap();
    await expect(page.locator('.r3-game')).toHaveAttribute('data-status', 'playing', { timeout: 90000 });
    await expect(page.getByTestId('movement-stick')).toBeVisible();
    await expect(page.getByTestId('aim-stick')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
    await page.getByRole('button', { name: 'EXIT SANDBOX' }).tap();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(requests.filter(url => /privy|walletconnect|accounts\.google|\/src\/main\.tsx|\/api\//i.test(url))).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
