import { selectPOV } from './controls';
import { expect, test, type Page } from '@playwright/test';
import { move } from '../rivals/traversal';

const state = (page: Page) => page.getByTestId('three-state');
async function character(page: Page) { return JSON.parse((await state(page).getAttribute('data-character')) || 'null') as { motion: string; clip: string; history: string[]; speed: number; time: number; yaw: number; actions: number; leg: number[]; socket: number[]; visible: boolean; mixerTime: number }; }
async function enter(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'ENTER 3D RAID' }).click();
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status', 'playing', { timeout: 90000 });
}
const pov = selectPOV;

test('real humanoid steps, sprints, jumps, rolls, collides and keeps animation state across four POVs', async ({ page }, info) => {
  test.setTimeout(300000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await enter(page);
  await expect.poll(async () => (await character(page))?.motion).toBe('idle');
  const stepping = await page.evaluate(() => new Promise<{ legs: number[]; sprintSpeed: number }>((resolve, reject) => {
    const node = document.querySelector<HTMLElement>('[data-testid=three-state]')!, legs: number[] = [];
    const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    const stop = () => { key('KeyS', false); key('ShiftLeft', false); observer.disconnect(); clearTimeout(timer); };
    const observer = new MutationObserver(() => {
      const c = JSON.parse(node.dataset.character || 'null'); if (!c) return;
      if (c.motion === 'run') { legs.push(c.leg[0]); if (legs.length >= 4) key('ShiftLeft', true); }
      if (c.motion === 'sprint' && c.speed > 8) { stop(); resolve({ legs, sprintSpeed: c.speed }); }
    });
    const timer = setTimeout(() => { stop(); reject(new Error('Gait cycle not reached')); }, 30000);
    observer.observe(node, { attributes: true, attributeFilter: ['data-character'] }); key('KeyS', true);
  }));
  expect(Math.max(...stepping.legs) - Math.min(...stepping.legs)).toBeGreaterThan(.005);
  expect(stepping.sprintSpeed).toBeGreaterThan(8);
  await expect.poll(async () => (await character(page)).motion).toBe('idle');
  const jumpHeight = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const node = document.querySelector<HTMLElement>('[data-testid=three-state]')!; let peak = 0;
    const observer = new MutationObserver(() => { peak = Math.max(peak, Number(node.dataset.y)); if (peak > .1 && node.dataset.grounded === 'true') { observer.disconnect(); clearTimeout(timer); resolve(peak); } });
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Jump did not land; peak ' + peak)); }, 20000);
    observer.observe(node, { attributes: true }); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ', bubbles: true }));
  }));
  expect(jumpHeight).toBeGreaterThan(.1);
  await expect.poll(async () => (await character(page)).history).toContain('land');
  const history = (await character(page)).history; expect(history).toContain('takeoff'); expect(history).toContain('fall');
  // Real dodge input; the controller's serial/cooldown proves repeated presses
  // cannot start an unlimited series of rolls.
  const dodgeSerials = await page.evaluate(() => new Promise<{ before: number; after: number }>((resolve, reject) => {
    const node = document.querySelector<HTMLElement>('[data-testid=arena-position]')!, before = Number(node.dataset.dodgeSerial); let repeatedAt = -1;
    const press = () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); };
    const observer = new MutationObserver(() => {
      if (repeatedAt < 0 && Number(node.dataset.dodgeSerial) > before) { repeatedAt = Number(node.dataset.missionElapsed); press(); }
      else if (repeatedAt >= 0 && Number(node.dataset.missionElapsed) - repeatedAt > .2) { observer.disconnect(); clearTimeout(timer); resolve({ before, after: Number(node.dataset.dodgeSerial) }); }
    });
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Dodge cooldown observation timed out')); }, 20000);
    observer.observe(node, { attributes: true }); press();
  }));
  await expect.poll(async () => (await character(page)).history).toContain('dodge');
  expect(dodgeSerials.after).toBe(dodgeSerials.before + 1);
  await expect.poll(async () => (await character(page)).motion).toBe('idle');
  await move(page, 'y', 288);
  const runId = await state(page).getAttribute('data-run');
  for (const [id, label] of [['side', 'ACTION / SIDE-VIEW'], ['third', 'THIRD-PERSON / TPS'], ['first', 'FIRST-PERSON / FPS'], ['tactical', 'TACTICAL / TOP-DOWN']] as const) {
    await pov(page, label); await expect(state(page)).toHaveAttribute('data-pov', id); await expect(state(page)).toHaveAttribute('data-run', runId!);
    await expect.poll(async () => (await character(page)).visible).toBe(id !== 'first');
    if (id === 'side') await expect.poll(async () => Math.abs(Math.sin((await character(page)).yaw))).toBeGreaterThan(.97);
    const sample = await character(page); expect(sample.socket.every(Number.isFinite)).toBe(true); expect(sample.actions).toBeLessThanOrEqual(6);
    await page.screenshot({ path: info.outputPath(id + '.png') });
  }
  // Existing transit route, existing closed door and real movement/dodge.
  await move(page, 'y', 576); await move(page, 'x', 576);
  await expect(page.getByTestId('arena-position')).toHaveAttribute('data-cooldown', '0.000');
  await page.keyboard.down('d'); await page.keyboard.press('Space');
  await expect.poll(async () => Number(await state(page).getAttribute('data-x'))).toBeGreaterThan(15);
  await expect.poll(async () => (await character(page)).speed).toBeLessThan(.01);
  const blockedX = Number(await state(page).getAttribute('data-x')); expect(blockedX).toBeLessThan(16.1);
  await expect.poll(async () => (await character(page)).motion).toBe('idle');
  await page.keyboard.up('d');
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const frozen = (await character(page)).mixerTime; await page.waitForTimeout(300); expect((await character(page)).mixerTime).toBe(frozen);
  await page.getByRole('button', { name: 'EXIT SANDBOX' }).click(); await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('actual touch-stick magnitude drives walk, jog, run and sprint with independent aiming', async ({ browser }, info) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(String(info.project.use.baseURL) + '/'); await page.getByRole('button', { name: 'ENTER 3D RAID' }).tap();
    await expect(page.locator('.r3-game')).toHaveAttribute('data-status', 'playing', { timeout: 90000 });
    const cdp = await context.newCDPSession(page), box = (await page.getByTestId('movement-stick').boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2, radius = Math.min(38, box.width * .28);
    for (const [magnitude, motion] of [[.25, 'walk'], [.65, 'jog'], [1, 'run']] as const) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y: y + radius * magnitude }] });
      await expect.poll(async () => (await character(page)).motion).toBe(motion);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(async () => (await character(page)).motion).toBe('idle');
      await move(page, 'y', 288);
    }
    const aimBox = (await page.getByTestId('aim-stick').boundingBox())!;
    // Stay aimed north while retreating south. Increasing analog magnitude
    // must switch the actual cached source clip, not just its requested name.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y: y + radius * .25 }, { id: 2, x: aimBox.x + aimBox.width / 2, y: aimBox.y + aimBox.height / 2 - 25 }] });
    await expect.poll(async () => (await character(page)).clip).toBe('Walk_Loop');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x, y: y + radius }, { id: 2, x: aimBox.x + aimBox.width / 2, y: aimBox.y + aimBox.height / 2 - 25 }] });
    await expect.poll(async () => (await character(page)).clip).toBe('Jog_Fwd_Loop');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Return through the real map before the sprint case; repeated southward
    // gestures can otherwise reach the room's south wall on a slow test host.
    await move(page, 'y', 288);
    await page.getByRole('button', { name: 'Toggle sprint' }).tap();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y: y + radius }] });
    await expect.poll(async () => (await character(page)).motion).toBe('sprint');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y: y + radius }, { id: 2, x: aimBox.x + aimBox.width / 2 + 25, y: aimBox.y + aimBox.height / 2 }] });
    await expect(page.getByTestId('arena-position')).toHaveAttribute('data-aiming', 'true');
    await expect.poll(async () => (await character(page)).clip).toBe('Sprint_Loop');
    const fireBox = (await page.getByRole('button', { name: 'Jump', exact: true }).boundingBox())!;
    const previousShots = Number(await page.getByTestId('arena-position').getAttribute('data-shots'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y: y + radius }, { id: 2, x: aimBox.x + aimBox.width / 2 + 25, y: aimBox.y + aimBox.height / 2 }, { id: 3, x: fireBox.x + fireBox.width / 2, y: fireBox.y + fireBox.height / 2 }] });
    await expect.poll(async () => Number(await page.getByTestId('arena-position').getAttribute('data-shots'))).toBeGreaterThan(previousShots);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.screenshot({ path: info.outputPath('touch-sprint-aim.png') });
    await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await page.getByRole('button', { name: 'EXIT SANDBOX' }).tap();
    await expect(page.locator('canvas')).toHaveCount(0); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
