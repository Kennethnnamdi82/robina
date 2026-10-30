import { expect, test, type Page } from '@playwright/test';
import { enter, leave, start, briefing } from './helpers';

const entry = '/tests/rivals/index.html';
const state = (page: Page) => page.getByTestId('arena-position');

test('all three operatives use separate transparent directional animation atlases', async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const errors: string[] = [], loaded: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/(vex|nyx|rook)\.webp/.test(request.url())) loaded.push(request.url()); });
  await page.goto(entry);
  for (const id of ['nyx', 'rook', 'vex']) {
    await briefing(page);
    await page.getByRole('button', { name: `Select ${id.toUpperCase()}` }).click();
    await enter(page); await expect(state(page)).toHaveAttribute('data-character', id);
    await page.keyboard.down('a');
    await expect(state(page)).toHaveAttribute('data-facing', 'left');
    await expect(state(page)).toHaveAttribute('data-animation', 'walk');
    const first = await state(page).getAttribute('data-frame');
    await expect.poll(() => state(page).getAttribute('data-frame')).not.toBe(first);
    await page.keyboard.up('a');
    await expect(state(page)).toHaveAttribute('data-animation', 'idle');
    await expect(state(page)).toHaveAttribute('data-frame', 'walk/left/2');
    await page.screenshot({ path: testInfo.outputPath(`${id}-operative.png`) });
    await leave(page);
  }
  expect(new Set(loaded.map(url => new URL(url).pathname)).size).toBe(3);
  expect(errors).toEqual([]);
  const alpha = await page.evaluate(async () => {
    const results = [];
    for (const id of ['vex', 'nyx', 'rook']) {
      const image = await createImageBitmap(await (await fetch(`/assets/rivals/phase02/${id}.webp`)).blob());
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
      for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
        const x = col * 192, y = row * 192;
        results.push(pixels[(y * image.width + x) * 4 + 3]);
        results.push(pixels[((y + 190) * image.width + x + 190) * 4 + 3]);
      }
      image.close();
    }
    return results;
  });
  expect(alpha.every(value => value === 0)).toBe(true);
});

test('quality changes preserve the same game and reduced motion is respected', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(entry); await enter(page);
  await expect(state(page)).toHaveAttribute('data-reduced-motion', 'true');
  const canvas = await page.locator('canvas').elementHandle();
  for (const quality of ['low', 'balanced', 'high']) {
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
    await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
    const before = await state(page).getAttribute('data-x');
    await page.getByLabel('Graphics quality', { exact: true }).selectOption(quality);
    await expect(state(page)).toHaveAttribute('data-quality', quality);
    expect(await state(page).getAttribute('data-x')).toBe(before);
    await page.getByRole('button', { name: 'Back to pause menu' }).click();
    await page.getByRole('button', { name: 'RESUME GAME' }).click();
    expect(await canvas!.evaluate(element => element.isConnected)).toBe(true);
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(`${quality}-quality.png`) });
  }
});

test('optional uplink supports real interaction without completing the mission or awarding rewards', async ({ page }) => {
  await page.goto(entry); await enter(page);
  // Drive DOM key events through Phaser, releasing inside the page at the actual
  // destination. This avoids automation latency and OS repeat moving past it.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const telemetry = document.querySelector('[data-testid="arena-position"]')!;
    const release = () => window.dispatchEvent(new KeyboardEvent('keyup', { key: 's', code: 'KeyS', keyCode: 83, which: 83, bubbles: true }));
    const observer = new MutationObserver(() => {
      if (Number(telemetry.getAttribute('data-y')) >= 380) { release(); observer.disconnect(); clearTimeout(timeout); resolve(); }
    });
    const timeout = window.setTimeout(() => { release(); observer.disconnect(); reject(new Error('Did not reach the insertion uplink')); }, 15000);
    observer.observe(telemetry, { attributes: true, attributeFilter: ['data-y'] });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', keyCode: 83, which: 83, bubbles: true }));
  }));
  await expect(page.getByLabel('Nearby equipment', { exact: true })).toContainText('Insertion uplink');
  await page.keyboard.press('e');
  await expect(page.getByLabel('Nearby equipment', { exact: true })).toContainText('Local uplink active.');
  await expect(page.getByLabel('Objective progress')).toHaveText('0 / 10');
  await expect(page.getByLabel('Active objective')).toContainText('Enter the restricted compound');
  await page.getByRole('button', { name: 'Inspect nearby equipment' }).click();
  await expect(page.getByLabel('Nearby equipment', { exact: true })).toContainText('Local uplink in standby.');
});

test('a corrupt atlas fails visibly and recovers after returning to the lobby', async ({ page }) => {
  await page.route('**/assets/rivals/phase02/vex.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ frames: {}, meta: { size: { w: 1152, h: 768 } } }) }));
  await page.goto(entry); await start(page);
  await expect(page.getByRole('alert')).toContainText('Missing atlas frame', { timeout: 90000 });
  await page.getByRole('button', { name: 'RETURN & RETRY' }).click();
  await page.unroute('**/assets/rivals/phase02/vex.json*');
  await enter(page);
});
