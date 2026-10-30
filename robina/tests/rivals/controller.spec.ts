import { expect, test } from '@playwright/test';
import { entry, enter, restart, leave } from './helpers';

test('desktop sprint, normalized diagonals, independent mouse aim and dodge cooldown are playable', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(entry); await enter(page);
  const state = page.getByTestId('arena-position');
  await page.keyboard.down('s'); await page.keyboard.down('d');
  await expect.poll(async () => Number(await state.getAttribute('data-speed'))).toBeGreaterThan(230);
  expect(Number(await state.getAttribute('data-speed'))).toBeLessThanOrEqual(235.01);
  await page.keyboard.up('s'); await page.keyboard.up('d');
  await page.keyboard.down('Shift'); await page.keyboard.down('s');
  await expect(state).toHaveAttribute('data-animation', 'run');
  await expect.poll(async () => Number(await state.getAttribute('data-speed'))).toBeGreaterThan(350);
  await page.keyboard.up('s'); await page.keyboard.up('Shift');
  await expect.poll(async () => Number(await state.getAttribute('data-speed'))).toBe(0);
  await page.mouse.move(1300, 480);
  await expect(state).toHaveAttribute('data-aiming', 'true');
  await expect(state).toHaveAttribute('data-facing', 'right');
  await page.keyboard.down('w');
  await expect(state).toHaveAttribute('data-animation', 'walk');
  await expect(state).toHaveAttribute('data-facing', 'right');
  await page.keyboard.up('w');
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  });
  await expect(state).toHaveAttribute('data-dodge-serial', '1');
  await expect.poll(async () => Number(await state.getAttribute('data-cooldown')), { timeout: 10000 }).toBe(0);
  await page.keyboard.press('Space'); await expect(state).toHaveAttribute('data-dodge-serial', '2');
  await page.screenshot({ path: info.outputPath('controller-desktop.png') });
  expect(errors).toEqual([]);
});

test('continue preserves the paused run and confirmed restart resets it with a single canvas', async ({ page }, info) => {
  await page.goto(entry); await enter(page);
  await page.keyboard.down('s'); await page.waitForTimeout(350); await page.keyboard.up('s');
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const state = page.getByTestId('arena-position'), before = await state.getAttribute('data-y'), canvas = await page.locator('canvas').elementHandle();
  const runId = await state.getAttribute('data-run-id');
  await page.screenshot({ path: info.outputPath('pause-menu-desktop.png') });
  await page.getByRole('button', { name: 'RETURN TO MAIN MENU' }).click();
  await expect(page.getByRole('button', { name: 'CONTINUE', exact: true })).toBeVisible();
  await page.waitForTimeout(400); expect(await state.getAttribute('data-y')).toBe(before);
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await expect(page.locator('.rivals-game-view')).toHaveAttribute('data-status', 'playing');
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.getByRole('button', { name: 'RESTART MISSION' }).click();
  await page.getByRole('button', { name: 'CANCEL', exact: true }).click();
  expect(await state.getAttribute('data-y')).toBe(before);
  await restart(page);
  await expect(state).toHaveAttribute('data-x', '288.00'); await expect(state).toHaveAttribute('data-y', '288.00');
  await expect(state).toHaveAttribute('data-health', '100'); await expect(page.getByLabel('Objective progress')).toHaveText('0 / 10');
  // Phaser may reuse the canvas element through CanvasPool; the run identity must change.
  await expect(state).not.toHaveAttribute('data-run-id', runId!);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.keyboard.press('Space'); await expect(state).toHaveAttribute('data-dodge-serial', '1');
});

test('live health, damage feedback, text focus guard and death lockout work through the QA-only adapter', async ({ page }, info) => {
  await page.goto(entry + '?validation=1'); await enter(page);
  await page.getByText('QA controls', { exact: true }).click();
  await page.getByRole('button', { name: 'Apply 25 damage' }).click();
  await expect(page.getByRole('progressbar', { name: 'Health', exact: true })).toHaveAttribute('aria-valuenow', '75');
  await expect(page.getByLabel('Damage indicator')).toBeAttached();
  const input = page.getByLabel('Input focus check');
  await input.focus();
  const state = page.getByTestId('arena-position'), x = await state.getAttribute('data-x'), y = await state.getAttribute('data-y');
  await page.keyboard.type('wasd'); await page.keyboard.press('Space'); await page.waitForTimeout(300);
  expect(await state.getAttribute('data-x')).toBe(x); expect(await state.getAttribute('data-y')).toBe(y);
  await page.getByRole('button', { name: 'Defeat operative' }).click();
  await expect(state).toHaveAttribute('data-health', '0'); await expect(state).toHaveAttribute('data-animation', 'defeat');
  const dead = [await state.getAttribute('data-x'), await state.getAttribute('data-y')];
  await page.keyboard.down('d'); await page.keyboard.press('Space'); await page.waitForTimeout(350); await page.keyboard.up('d');
  expect([await state.getAttribute('data-x'), await state.getAttribute('data-y')]).toEqual(dead);
  await page.screenshot({ path: info.outputPath('defeat-validation.png') });
});

test('mobile owns two sticks independently, cancels pointers and supports sprint and dodge', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage(); await page.goto(String(info.project.use.baseURL) + entry); await enter(page);
  const state = page.getByTestId('arena-position');
  const move = (await page.getByTestId('movement-stick').boundingBox())!, aim = (await page.getByTestId('aim-stick').boundingBox())!;
  const left = { id: 11, x: move.x + move.width / 2, y: move.y + move.height / 2 }, right = { id: 22, x: aim.x + aim.width / 2, y: aim.y + aim.height / 2 };
  expect(move.x + move.width).toBeLessThan(aim.x);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left, right] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...left, y: left.y + 30 }, { ...right, x: right.x - 30 }] });
  await expect(state).toHaveAttribute('data-animation', 'walk'); await expect(state).toHaveAttribute('data-facing', 'left');
  await expect(state).toHaveAttribute('data-aiming', 'true');
  const y = Number(await state.getAttribute('data-y'));
  // Release the aim contact, preserving the movement contact's pointer ownership.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ ...right, x: right.x - 30 }] });
  await expect(state).toHaveAttribute('data-aiming', 'false');
  await expect.poll(async () => Number(await state.getAttribute('data-y')), { timeout: 10000 }).toBeGreaterThan(y + 25);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect.poll(async () => Number(await state.getAttribute('data-speed'))).toBe(0);
  await expect(page.getByRole('button', { name: 'Fire weapon', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Toggle sprint' }).tap(); await expect(page.getByRole('button', { name: 'Toggle sprint' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Dodge', exact: true }).tap(); await expect(state).toHaveAttribute('data-dodge-serial', '1');
  await page.screenshot({ path: info.outputPath('controller-mobile-portrait.png') });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  await page.setViewportSize({ width: 844, height: 390 }); await page.getByRole('button', { name: 'RESUME GAME' }).tap();
  const canvas = (await page.locator('canvas').boundingBox())!; expect(canvas.width).toBe(844); expect(canvas.height).toBe(390);
  await page.screenshot({ path: info.outputPath('controller-mobile-landscape.png') });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).tap();
  await page.getByLabel('Mobile controls', { exact: true }).selectOption('hide');
  await page.getByRole('button', { name: 'Back to pause menu' }).tap();
  await page.getByRole('button', { name: 'RESUME GAME' }).tap();
  await expect(page.getByTestId('movement-stick')).toHaveCount(0);
  await expect(page.getByTestId('aim-stick')).toHaveCount(0);
  await context.close();
});

test('optional audio is released on exit instead of surviving game destruction', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio, sounds: HTMLAudioElement[] = [];
    Object.defineProperty(window, '__rivalsAudio', { value: sounds });
    window.Audio = function (src?: string) { const sound = new NativeAudio(src); sounds.push(sound); return sound; } as unknown as typeof Audio;
  });
  await page.goto(entry); await enter(page);
  await page.getByRole('button', { name: 'Enable ambient audio' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rivalsAudio: HTMLAudioElement[] }).__rivalsAudio.length)).toBeGreaterThan(0);
  await leave(page, false);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rivalsAudio: HTMLAudioElement[] }).__rivalsAudio.every(sound => sound.paused && sound.getAttribute('src') === ''))).toBe(true);
});
