import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { entry, enter, restart, leave } from './helpers';

import { state, move, interact, aim, defeat, breach, fightGuardian } from './traversal';

test('pulse carbine hits targets, cover blocks shots, reload and pause freeze combat, restart resets the pool', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(entry); await enter(page);
  await expect(page.getByLabel('Equipped weapon')).toContainText('PULSE CARBINE');
  // Cover at x480/y288 must absorb eastbound shots.
  await aim(page, 600, 288); await page.mouse.down();
  await expect.poll(async () => Number(await state(page).getAttribute('data-shots'))).toBeGreaterThanOrEqual(3);
  await page.mouse.up(); await expect(state(page)).toHaveAttribute('data-targets', '100,100,100');
  // Stand off the A-to-B line so valid trailing rounds cannot hit the target behind A.
  await move(page, 'y', 480); await move(page, 'x', 192); await aim(page, 416, 640); await page.mouse.down();
  await expect.poll(async () => Number(await state(page).getAttribute('data-kills')), { timeout: 20000 }).toBe(1);
  await page.mouse.up(); await expect(state(page)).toHaveAttribute('data-targets', '0,100,100');
  await expect(page.getByLabel('Hit confirmation')).toBeAttached();
  await page.keyboard.press('r'); await expect.poll(async () => Number(await state(page).getAttribute('data-reload'))).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  const shots = await state(page).getAttribute('data-shots'), reload = await state(page).getAttribute('data-reload');
  await page.waitForTimeout(600); expect(await state(page).getAttribute('data-shots')).toBe(shots); expect(await state(page).getAttribute('data-reload')).toBe(reload);
  await page.getByRole('button', { name: 'RESUME GAME', exact: true }).click();
  await expect(state(page)).toHaveAttribute('data-ammo', '12', { timeout: 15000 });
  await expect(state(page)).toHaveAttribute('data-projectiles', '0');
  await page.screenshot({ path: info.outputPath('combat-desktop.png') });
  await restart(page);
  await expect(state(page)).toHaveAttribute('data-shots', '0'); await expect(state(page)).toHaveAttribute('data-targets', '100,100,100');
  await expect(state(page)).toHaveAttribute('data-ammo', '12'); await expect(page.locator('canvas')).toHaveCount(1);
  await leave(page, false); expect(errors).toEqual([]);
});

test('real heist: fight guards, fail and complete hacking, link phase pads, activate relays, open vault and extract', async ({ page }, info) => {
  test.setTimeout(600000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(entry); await enter(page);
  await expect(state(page)).toHaveAttribute('data-enemy-health', '75,100,175');
  await expect(state(page)).toHaveAttribute('data-alarm', 'false');
  await move(page, 'y', 576); await move(page, 'x', 576);
  await page.keyboard.down('d');
  await expect.poll(async () => Number(await state(page).getAttribute('data-x')), { timeout: 15000 }).toBeGreaterThan(620);
  await page.keyboard.up('d'); expect(Number(await state(page).getAttribute('data-x'))).toBeLessThan(630);
  await interact(page, 'Transit shutter');
  await move(page, 'x', 800); await defeat(page, 'guard-01');
  await expect(state(page)).toHaveAttribute('data-enemy-deaths', '1');
  await page.screenshot({ path: info.outputPath('guard-encounter.png') });
  await move(page, 'x', 864); await move(page, 'y', 672); await move(page, 'x', 976);
  await breach(page, true);
  const frozen = await state(page).getAttribute('data-enemies'), clock = await page.getByLabel('Session time').textContent();
  await page.waitForTimeout(650);
  expect(await state(page).getAttribute('data-enemies')).toBe(frozen);
  expect(await page.getByLabel('Session time').textContent()).toBe(clock);
  await page.screenshot({ path: info.outputPath('hack-success.png') });
  await page.getByRole('button', { name: 'RETURN TO FIELD' }).click();
  await expect(state(page)).toHaveAttribute('data-hacking', 'false');
  await expect.poll(async () => await state(page).getAttribute('data-enemy-states'), { timeout: 15000 }).toMatch(/enforcer-01:(INVESTIGATE|CHASE|ATTACK|SEARCH)/);
  await move(page, 'y', 760); await defeat(page, 'enforcer-01');
  await move(page, 'x', 864); await move(page, 'y', 920);
  await expect.poll(async () => {
    const d = await state(page).evaluate(n => ({ ...n.dataset }));
    return d.phase === 'ACTIVE' && Number(d.phaseWindow) > 4;
  }, { timeout: 30000, intervals: [100] }).toBe(true);
  await interact(page, 'Phase pad WEST');
  await move(page, 'x', 1024); await interact(page, 'Phase pad EAST');
  await expect(state(page)).toHaveAttribute('data-phase-link', 'true');
  await page.screenshot({ path: info.outputPath('phase-link.png') });
  // The sector console is solid: return through the open concourse, west of its footprint.
  await move(page, 'x', 944); await move(page, 'y', 576); await move(page, 'x', 1088); await move(page, 'y', 560);
  await interact(page, 'Restricted sector door');
  await expect(state(page)).toHaveAttribute('data-doors', 'transit-door,vault-gate');
  // Take the north firing lane: relay A is real cover between the gate and the heavy.
  await move(page, 'y', 208); await defeat(page, 'heavy-01');
  await expect(state(page)).toHaveAttribute('data-enemy-deaths', '3');
  await move(page, 'y', 320); await move(page, 'x', 1184); await interact(page, 'Vault relay A');
  await expect(state(page)).toHaveAttribute('data-relays', '1');
  await move(page, 'y', 240); await move(page, 'x', 1440);
  await expect(page.getByLabel('Nearby equipment', { exact: true })).toContainText('relay B');
  const revision = await state(page).getAttribute('data-world-revision');
  await page.keyboard.press('e'); await page.waitForTimeout(350);
  await expect(state(page)).toHaveAttribute('data-world-revision', revision!);
  // Route south of the locked vault's actual footprint before approaching relay B.
  await move(page, 'y', 272);
  await move(page, 'x', 1504); await move(page, 'y', 336, 8);
  await interact(page, 'Vault relay B'); await expect(state(page)).toHaveAttribute('data-relays', '2');
  await expect(state(page)).toHaveAttribute('data-boss-state','INTRO');
  await page.screenshot({ path: info.outputPath('guardian-reveal.png') });
  // Desktop lets the brief reveal finish; the touch encounter separately tests Skip.
  await expect(state(page)).not.toHaveAttribute('data-boss-state','INTRO');
  const battle = fightGuardian(page);
  await expect(state(page)).toHaveAttribute('data-boss-phase','B',{ timeout: 60000 });
  await page.screenshot({ path: info.outputPath('guardian-phase-b.png') });
  await expect(state(page)).toHaveAttribute('data-boss-phase','C',{ timeout: 120000 });
  await page.screenshot({ path: info.outputPath('guardian-final-stand.png') });
  const samples = await battle;
  await writeFile(info.outputPath('guardian-performance.json'),JSON.stringify({ viewport: '1440x1000',renderer: 'canvas',throttle: 1,samples },null,2));
  await expect(state(page)).toHaveAttribute('data-boss-state','DEFEATED');
  await move(page,'y',272); await move(page,'x',1504);
  await move(page, 'y', 272); await interact(page, 'Central vault access');
  await move(page, 'y', 320); await interact(page, 'Training Vault Core');
  await expect(state(page)).toHaveAttribute('data-core', 'true');
  await page.screenshot({ path: info.outputPath('vault-access.png') });
  await move(page, 'x', 1320); await move(page, 'y', 240); await move(page, 'x', 1088);
  await move(page, 'y', 576); await move(page, 'x', 864);
  await move(page, 'y', 992); await move(page, 'x', 576); await move(page, 'y', 1152); await move(page, 'x', 350);
  await interact(page, 'South extraction'); await expect(state(page)).toHaveAttribute('data-extracted', 'true');
  await expect(state(page)).toHaveAttribute('data-mission-state','SUCCESS');
  await expect(page.getByRole('heading',{ name: 'Mission complete.' })).toBeVisible();
  await expect(page.getByRole('dialog',{ name: 'Mission complete.' })).toContainText('Local practice only');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rivals_practice_progress_v1')!));
  expect(stored.completions).toBe(1); expect(stored.practiceXP).toBe(100);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rivals_practice_progress_v1')!).completions)).toBe(1);
  await page.screenshot({ path: info.outputPath('extraction-desktop.png') });
  await page.getByRole('button',{ name: 'REPLAY MISSION' }).click();
  await page.getByRole('button',{ name: 'RESTART',exact: true }).click();
  await expect(state(page)).toHaveAttribute('data-core', 'false'); await expect(state(page)).toHaveAttribute('data-doors', '');
  await expect(state(page)).toHaveAttribute('data-enemy-health', '75,100,175');
  await expect(state(page)).toHaveAttribute('data-enemy-deaths', '0'); await expect(state(page)).toHaveAttribute('data-hacks', '0');
  await expect(state(page)).toHaveAttribute('data-phase-link', 'false'); await expect(state(page)).toHaveAttribute('data-relays', '0');
  await expect(state(page)).toHaveAttribute('data-boss-state','DORMANT'); await expect(state(page)).toHaveAttribute('data-boss-health','450');
  await expect(state(page)).toHaveAttribute('data-mission-completed','0');
  await page.getByRole('button',{ name: 'Pause game',exact: true }).click();
  await page.getByRole('button',{ name: 'RETURN TO MAIN MENU',exact: true }).click();
  await page.getByRole('button',{ name: /MISSIONS/ }).click(); await page.getByRole('button',{ name: /VIEW BRIEFING/ }).click();
  await expect(page.locator('.rv-practice-summary')).toContainText('1 clears');
  await page.reload(); await page.getByRole('button',{ name: 'PLAY',exact: true }).click();
  await expect(page.locator('.rv-practice-summary')).toContainText('100 XP');
  expect(errors).toEqual([]);
});

test('enabled range projectiles cause genuine damage and death; restarting restores health', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto(entry); await enter(page);
  await move(page, 'y', 640); await move(page, 'x', 235); await interact(page, 'Live-fire range switch');
  await expect(state(page)).toHaveAttribute('data-range-active', 'true');
  await move(page, 'y', 800); await move(page, 'x', 384);
  await expect.poll(async () => Number(await state(page).getAttribute('data-health')), { timeout: 20000 }).toBeLessThan(100);
  await expect(page.getByLabel('Damage indicator')).toBeAttached();
  await page.screenshot({ path: info.outputPath('range-damage.png') });
  await expect(state(page)).toHaveAttribute('data-health', '0', { timeout: 40000 });
  await expect(page.getByRole('heading', { name: 'Regroup. Re-enter.' })).toBeVisible();
  await expect(state(page)).toHaveAttribute('data-projectiles', '0');
  await page.getByRole('button', { name: 'RESTART MISSION', exact: true }).click();
  await page.getByRole('button', { name: 'RESTART', exact: true }).click();
  await expect(state(page)).toHaveAttribute('data-health', '100'); await expect(state(page)).toHaveAttribute('data-range-active', 'false');
});

test('mobile movement, aim and fire coexist; cancellation stops firing and reload works after resize', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage(); await page.goto(String(info.project.use.baseURL) + entry); await enter(page);
  const moveBox = (await page.getByTestId('movement-stick').boundingBox())!, aimBox = (await page.getByTestId('aim-stick').boundingBox())!, fireBox = (await page.getByRole('button', { name: 'Fire weapon', exact: true }).boundingBox())!;
  const left = { id: 1, x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 };
  const right = { id: 2, x: aimBox.x + aimBox.width / 2, y: aimBox.y + aimBox.height / 2 };
  const fire = { id: 3, x: fireBox.x + fireBox.width / 2, y: fireBox.y + fireBox.height / 2 };
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left, right, fire] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...left, y: left.y + 28 }, { ...right, x: right.x + 30 }, fire] });
  await expect.poll(async () => Number(await state(page).getAttribute('data-shots'))).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => Number(await state(page).getAttribute('data-y'))).toBeGreaterThan(320);
  await expect(state(page)).toHaveAttribute('data-facing', 'right');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect.poll(async () => Number(await state(page).getAttribute('data-speed'))).toBe(0);
  const before = await state(page).getAttribute('data-shots'); await page.waitForTimeout(450); expect(await state(page).getAttribute('data-shots')).toBe(before);
  await page.screenshot({ path: info.outputPath('combat-mobile-portrait.png') });
  await page.getByRole('button', { name: 'Reload weapon', exact: true }).tap(); await expect(state(page)).toHaveAttribute('data-ammo', '12', { timeout: 10000 });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'RESUME GAME', exact: true }).tap();
  expect((await page.locator('canvas').boundingBox())!.width).toBe(844);
  const network = (await page.getByLabel('Security link').boundingBox())!;
  expect(network.y + network.height).toBeLessThan(390 * .4);
  if (await page.getByLabel('Nearby equipment', { exact: true }).isVisible()) await expect(page.getByLabel('Field status')).toBeHidden();
  else {
    const field = (await page.getByLabel('Field status').boundingBox())!;
    expect(field.y).toBeGreaterThan(390 / 2); expect(network.y + network.height).toBeLessThan(field.y);
  }
  await page.screenshot({ path: info.outputPath('combat-mobile-landscape.png') });
  await context.close();
});
