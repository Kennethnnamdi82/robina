import { expect, test } from '@playwright/test';
import { entry, enter, briefing, restart } from './helpers';
import { state, move, interact, reachGuardian } from './traversal';

test('early extraction is rejected, mission markers track objectives, and restart records no reward', async ({ page },info) => {
  await page.goto(entry); await enter(page);
  await expect(state(page)).toHaveAttribute('data-mission-state','ACTIVE'); await expect(state(page)).toHaveAttribute('data-mission-remaining','none');
  await expect(page.getByLabel('Mission objective marker')).toBeAttached();
  await move(page,'y',992); await move(page,'x',576); await move(page,'y',1152); await move(page,'x',350);
  await interact(page,'South extraction');
  await expect(state(page)).toHaveAttribute('data-extracted','false'); await expect(state(page)).toHaveAttribute('data-mission-state','ACTIVE');
  await page.screenshot({ path: info.outputPath('invalid-extraction.png') });
  await restart(page);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('rivals_practice_progress_v1')!));
  expect(p.completions).toBe(0); expect(p.practiceXP).toBe(0); expect(p.history[0].state).toBe('ABANDONED');
});

test('optional timed mode is disclosed before insertion, pauses its clock, and defeat records failure only', async ({ page },info) => {
  await page.goto(entry + '?validation=1'); await briefing(page);
  await page.getByLabel('Mission timing').selectOption('timed');
  await expect(page.getByText('8-minute challenge',{ exact: true })).toBeVisible();
  await page.getByRole('button',{ name: 'START MISSION',exact: true }).click();
  await expect(state(page)).toHaveAttribute('data-mission-mode','timed');
  await expect.poll(async () => Number(await state(page).getAttribute('data-mission-remaining'))).toBeLessThan(480);
  await page.getByRole('button',{ name: 'Pause game',exact: true }).click();
  const remaining = await state(page).getAttribute('data-mission-remaining'); await page.waitForTimeout(500);
  expect(await state(page).getAttribute('data-mission-remaining')).toBe(remaining);
  await page.getByRole('button',{ name: 'RESUME GAME',exact: true }).click();
  await page.getByText('QA controls',{ exact: true }).click(); await page.getByRole('button',{ name: 'Defeat operative',exact: true }).click();
  await expect(state(page)).toHaveAttribute('data-mission-state','FAILED');
  await expect(page.getByRole('dialog',{ name: 'Regroup. Re-enter.' })).toContainText('Operative defeated.');
  await page.screenshot({ path: info.outputPath('mission-defeat.png') });
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('rivals_practice_progress_v1')!));
  expect(p.completions).toBe(0); expect(p.practiceXP).toBe(0); expect(p.history[0].state).toBe('FAILED');
  await page.getByRole('button',{ name: 'RETURN TO MAIN MENU',exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('Guardian encounter supports mobile reveal, touch controls, pause, lethal attacks and clean restart', async ({ browser },info) => {
  test.setTimeout(420000);
  const context = await browser.newContext({ viewport: { width: 390,height: 844 },hasTouch: true,isMobile: true,deviceScaleFactor: 2 });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror',e => errors.push(e.message));
  await page.goto(String(info.project.use.baseURL) + entry); await enter(page); await reachGuardian(page);
  await expect(page.getByLabel('Vault Guardian encounter')).toBeVisible();
  await page.screenshot({ path: info.outputPath('guardian-mobile-reveal.png') });
  if (await page.getByRole('button',{ name: 'SKIP REVEAL' }).isVisible()) await page.getByRole('button',{ name: 'SKIP REVEAL' }).tap();
  await expect(state(page)).not.toHaveAttribute('data-boss-state','INTRO');
  await page.getByRole('button',{ name: 'Pause game',exact: true }).tap();
  const boss = await state(page).getAttribute('data-boss'), elapsed = await state(page).getAttribute('data-mission-elapsed');
  await page.waitForTimeout(500); expect(await state(page).getAttribute('data-boss')).toBe(boss); expect(await state(page).getAttribute('data-mission-elapsed')).toBe(elapsed);
  await page.setViewportSize({ width: 844,height: 390 });
  await page.getByRole('button',{ name: 'RESUME GAME',exact: true }).tap();
  await expect.poll(async () => Number(await state(page).getAttribute('data-camera-zoom'))).toBeCloseTo(.82,2);
  await expect(page.getByLabel('Nearby equipment',{ exact: true })).toHaveCount(0);
  const hud = (await page.getByLabel('Vault Guardian encounter').boundingBox())!, controls = (await page.getByTestId('movement-stick').boundingBox())!;
  expect(hud.y + hud.height).toBeLessThan(controls.y);
  const serial = Number(await state(page).getAttribute('data-dodge-serial'));
  await page.getByRole('button',{ name: 'Dodge',exact: true }).tap();
  await expect.poll(async () => Number(await state(page).getAttribute('data-dodge-serial'))).toBeGreaterThan(serial);
  await expect.poll(async () => Number(await state(page).getAttribute('data-cooldown'))).toBeLessThan(.7);
  const beforeShots = Number(await state(page).getAttribute('data-shots'));
  await page.getByRole('button',{ name: 'Fire weapon',exact: true }).tap();
  await expect.poll(async () => Number(await state(page).getAttribute('data-shots'))).toBeGreaterThan(beforeShots);
  await page.screenshot({ path: info.outputPath('guardian-mobile-landscape.png') });
  // Stay in its clear firing lane: genuine Guardian projectiles must end the mission.
  await move(page,'y',272); await move(page,'x',1320);
  await expect(state(page)).toHaveAttribute('data-mission-state','FAILED',{ timeout: 90000 });
  await expect(page.getByRole('dialog',{ name: 'Regroup. Re-enter.' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('guardian-player-defeat.png') });
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('rivals_practice_progress_v1')!));
  expect(p.completions).toBe(0); expect(p.practiceXP).toBe(0);
  await restart(page); await expect(state(page)).toHaveAttribute('data-boss-state','DORMANT'); await expect(state(page)).toHaveAttribute('data-boss-health','450');
  await expect(state(page)).toHaveAttribute('data-projectiles','0'); await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]); await context.close();
});
