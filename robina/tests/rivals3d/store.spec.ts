import { expect, test } from '@playwright/test';

test('premium store is responsive, navigable and does not run WebGL behind product cards', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/rivals3d/store.html');
  await expect(page.getByRole('heading', { name: 'THE EXCHANGE' })).toBeVisible();
  await page.locator('.rs-card img').first().waitFor();
  for (const [width, height] of [[1440, 1000], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), width + ' page overflow').toBe(true);
    expect(await page.locator('canvas').count()).toBe(0);
    await expect.poll(async () => page.locator('.rs-store img').evaluateAll(images => images.filter(i => (i as HTMLImageElement).complete && !(i as HTMLImageElement).naturalWidth).length)).toBe(0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: info.outputPath('exchange-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: info.outputPath('exchange-phone.png'), fullPage: true });
  const nav = page.getByRole('navigation', { name: 'Store categories' });
  for (const label of ['Guns & weapons', 'Grenades', 'Character skins', 'Weapon cosmetics', 'Emotes & effects', 'Premium bundles', 'Season pass', 'Founder pack', 'My inventory', 'Purchase history']) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await nav.getByRole('link', { name: 'Guns & weapons', exact: true }).click();
  await page.getByRole('button', { name: 'Details for M4A1', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByText('COLLECTION SHOWROOM')).toBeVisible();
  await page.getByRole('button', { name: 'REVIEW SELECTION', exact: true }).click();
  await expect(page.getByText('PAYMENT PREVIEW / NO CHARGES')).toBeVisible();
  await page.getByRole('button', { name: /Base USDC/ }).click();
  await page.getByRole('button', { name: 'PREVIEW CONFIRMATION' }).click();
  await expect(page.getByRole('heading', { name: 'PAYMENT PROCESSING' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('purchase-phone.png'), fullPage: true });
  // Radix traps focus and restores it on dismissal. No preview can persist ownership.
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Details for M4A1', exact: true })).toBeFocused();
  expect(await page.evaluate(() => localStorage.length)).toBe(0); expect(errors).toEqual([]);
});

test('one real 3D reference preview loads on demand and is released on dismissal', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/rivals3d/store.html?page=/store/weapons');
  await page.getByRole('button', { name: 'Details for AK-47', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'INSPECT IN 3D' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByText('OPENING THE STUDIO')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Interactive ak47 collection model' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('weapon-studio.png') });
  await page.getByRole('button', { name: 'Close product details' }).click();
  await expect(page.locator('canvas')).toHaveCount(0); expect(errors).toEqual([]);
});

test('recovery states stay labeled and static, and fit small phones', async ({ page }, info) => {
  await page.goto('/tests/rivals3d/store.html?page=/recovery');
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('YOUR SOLDIER HAS FALLEN')).toBeVisible();
  await page.screenshot({ path: info.outputPath('recovery-phone.png'), fullPage: true });
  await page.getByLabel('Recovery preview state').selectOption('successful');
  await expect(page.getByText('READY TO RETURN')).toBeVisible();
  await page.getByLabel('Recovery preview state').selectOption('unconfirmed');
  await expect(page.getByText('Recovery unconfirmed — Do not assume payment succeeded')).toBeVisible();
});
