import { expect, test } from '@playwright/test';
import { entry, enter, restart } from './helpers';
import { state, move, interact, defeat, breach } from './traversal';

test('guards patrol and fire damaging projectiles; diagnostics require the isolated QA entry', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto(entry); await enter(page);
  await expect(page.getByText('AI diagnostics', { exact: true })).toHaveCount(0);
  const initial = await state(page).getAttribute('data-enemies');
  await expect.poll(() => state(page).getAttribute('data-enemies')).not.toBe(initial);
  await expect(state(page)).toHaveAttribute('data-enemy-shots', '0');
  await move(page, 'y', 576); await move(page, 'x', 576); await interact(page, 'Transit shutter');
  await move(page, 'x', 800); await move(page, 'y', 736);
  await expect.poll(async () => Number(await state(page).getAttribute('data-enemy-shots')), { timeout: 30000 }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await state(page).getAttribute('data-health')), { timeout: 30000 }).toBeLessThan(100);
  await page.screenshot({ path: info.outputPath('guard-attack.png') });
  await restart(page); await expect(state(page)).toHaveAttribute('data-health', '100');
  await expect(state(page)).toHaveAttribute('data-enemy-shots', '0');
  await page.goto(entry + '?validation=1'); await enter(page);
  await page.getByText('QA controls', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'AI diagnostics' }).check();
  await expect(state(page)).toHaveAttribute('data-debug', 'true');
  await page.getByRole('checkbox', { name: 'AI diagnostics' }).uncheck();
  await expect(state(page)).toHaveAttribute('data-debug', 'false');
});

test('mobile terminal supports touch failure, retry, success, resize, cancel and movement after closing', async ({ browser }, info) => {
  test.setTimeout(300000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(String(info.project.use.baseURL) + entry); await enter(page);
  await move(page, 'y', 576); await move(page, 'x', 576); await interact(page, 'Transit shutter');
  await move(page, 'x', 800); await defeat(page, 'guard-01');
  await move(page, 'x', 864); await move(page, 'y', 672); await move(page, 'x', 976);
  await interact(page, 'Sector access terminal');
  await page.screenshot({ path: info.outputPath('hack-input-mobile.png') });
  await page.getByRole('button', { name: 'Close hacking terminal' }).tap();
  await expect(state(page)).toHaveAttribute('data-hacks', '0');
  await breach(page, true, true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('hack-mobile-portrait.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'RETURN TO FIELD' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('hack-mobile-landscape.png') });
  await page.getByRole('button', { name: 'RETURN TO FIELD' }).tap();
  await expect(page.getByTestId('movement-stick')).toBeVisible();
  await move(page, 'x', 900); await expect(state(page)).toHaveAttribute('data-hacking', 'false');
  expect(errors).toEqual([]); await context.close();
});

test('a scanning camera raises a real alarm and a live laser beam damages the operative', async ({ page }, info) => {
  test.setTimeout(360000);
  await page.goto(entry); await enter(page);
  await move(page, 'y', 224); await move(page, 'x', 568); await move(page, 'y', 300);
  await expect(state(page)).toHaveAttribute('data-alarm', 'true', { timeout: 60000 });
  await expect(state(page)).toHaveAttribute('data-alarm-serial', '1');
  await page.screenshot({ path: info.outputPath('camera-alarm.png') });
  await restart(page);
  await move(page, 'y', 576); await move(page, 'x', 576); await interact(page, 'Transit shutter');
  await move(page, 'x', 800); await defeat(page, 'guard-01');
  // Brake short of the beam: fixed-step movement still has a small stopping distance.
  await move(page, 'x', 1088); await move(page, 'y', 566, 2);
  await expect(state(page)).toHaveAttribute('data-damage-amount', '12', { timeout: 45000 });
  await expect(state(page)).toHaveAttribute('data-alarm', 'true');
  await expect(state(page)).toHaveAttribute('data-hacks', '0');
  await page.screenshot({ path: info.outputPath('laser-damage.png') });
});
