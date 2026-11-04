import { selectPOV } from './controls';
import { expect, test, type Page } from '@playwright/test';
import { move } from '../rivals/traversal';
import { writeFile } from 'node:fs/promises';
const entry = '/tests/rivals3d/index.html';
const state = (p: Page) => p.getByTestId('three-state');
async function enter(page: Page) { await page.goto(entry); await page.getByRole('button',{ name: 'ENTER 3D RAID' }).click(); await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{ timeout: 90000 }); }
const pov = selectPOV;
test('four POVs, zoom, jump, pause, reload and original Phaser fallback share a real raid',async ({ page },info) => {
  test.setTimeout(240000); const errors: string[] = []; page.on('pageerror',e => errors.push(e.message));
  await enter(page); await expect(state(page)).toHaveAttribute('data-pov','tactical');
  await expect(page.locator('canvas')).toHaveCount(1); const run = await state(page).getAttribute('data-run');
  await page.screenshot({ path: info.outputPath('tactical.png') });
  await move(page,'y',384);
  await expect(page.getByLabel('Nearby equipment',{ exact: true })).toContainText('Insertion uplink'); await page.keyboard.press('e');
  await expect(page.getByLabel('Nearby equipment',{ exact: true })).toContainText('Local uplink active.');
  for (const [id,label] of [['third','THIRD-PERSON / TPS'],['first','FIRST-PERSON / FPS'],['side','ACTION / SIDE-VIEW']] as const) {
    const before = await state(page).evaluate(n => ({ x: Number(n.dataset.x),z: Number(n.dataset.z) }));
    await pov(page,label); await expect(state(page)).toHaveAttribute('data-pov',id); await expect(state(page)).toHaveAttribute('data-run',run!); await expect(state(page)).toHaveAttribute('data-enemy-count','3');
    const after = await state(page).evaluate(n => ({ x: Number(n.dataset.x),z: Number(n.dataset.z) })); expect(Math.hypot(after.x - before.x,after.z - before.z)).toBeLessThan(.3);
    await page.getByRole('button',{ name: 'Camera zoom',exact: true }).click(); await page.screenshot({ path: info.outputPath(id + '.png') });
  }
  await page.keyboard.press('j'); await expect.poll(async () => Number(await state(page).getAttribute('data-y'))).toBeGreaterThan(.1);
  await page.keyboard.press('v'); await expect(state(page)).toHaveAttribute('data-pov','third');
  await expect(state(page)).toHaveAttribute('data-grounded','true',{ timeout: 15000 });
  await pov(page,'FIRST-PERSON / FPS'); const shots = Number(await page.getByTestId('arena-position').getAttribute('data-shots'));
  await page.mouse.click(720,450); await expect.poll(async () => Number(await page.getByTestId('arena-position').getAttribute('data-shots'))).toBeGreaterThan(shots);
  await page.keyboard.press('r'); await expect(page.getByTestId('arena-position')).toHaveAttribute('data-ammo','12',{ timeout: 15000 });
  await page.getByRole('button',{ name: 'Pause game',exact: true }).click(); const frozen = await page.getByTestId('arena-position').getAttribute('data-mission-elapsed'); await page.waitForTimeout(400); expect(await page.getByTestId('arena-position').getAttribute('data-mission-elapsed')).toBe(frozen);
  await page.getByRole('button',{ name: 'RESUME RAID' }).click(); await page.getByRole('button',{ name: 'Pause game',exact: true }).click(); await page.getByRole('link',{ name: 'ORIGINAL PHASER FALLBACK' }).click();
  await expect(page.getByRole('button',{ name: 'PLAY',exact: true })).toBeVisible({ timeout: 45000 }); await expect(page.locator('canvas')).toHaveCount(0); expect(errors).toEqual([]);
  await page.getByRole('button',{ name: 'PLAY',exact: true }).click(); await page.getByRole('button',{ name: 'START MISSION',exact: true }).click();
  await expect(page.locator('.rivals-game-view')).toHaveAttribute('data-status','playing',{ timeout: 90000 }); await expect(page.locator('canvas')).toHaveCount(1);
});
test('converted gate blocks movement; real 3D projectiles defeat a guard once and settle its corpse',async ({ page },info) => {
  test.setTimeout(300000); await enter(page);
  await move(page,'y',576); await move(page,'x',576);
  await page.keyboard.down('d'); await page.waitForTimeout(600); await page.keyboard.up('d'); expect(Number(await page.getByTestId('arena-position').getAttribute('data-x'))).toBeLessThan(645);
  await expect(page.getByLabel('Nearby equipment',{ exact: true })).toContainText('Transit shutter'); await page.keyboard.press('e');
  await move(page,'x',800); await move(page,'y',720);
  await page.evaluate(() => new Promise<void>((resolve,reject) => {
    const node = document.querySelector<HTMLElement>('[data-testid=three-state]')!,telemetry = document.querySelector<HTMLElement>('[data-testid=arena-position]')!,canvas = document.querySelector('canvas')!;
    const stop = () => window.dispatchEvent(new PointerEvent('pointerup',{ button: 0,bubbles: true }));
    const update = () => {
      const target = JSON.parse(node.dataset.targets || '[]').find((t: { id: string }) => t.id === 'guard-01');
      const enemies = JSON.parse(telemetry.dataset.enemies || '[]');
      if (enemies[0]?.health <= 0) { stop(); observer.disconnect(); clearTimeout(timer); resolve(); return; }
      if (target?.visible) { const rect = canvas.getBoundingClientRect(); canvas.dispatchEvent(new PointerEvent('pointermove',{ clientX: rect.x + target.x,clientY: rect.y + target.y,bubbles: true })); canvas.dispatchEvent(new PointerEvent('pointerdown',{ button: 0,clientX: rect.x + target.x,clientY: rect.y + target.y,bubbles: true })); }
    };
    const timer = setTimeout(() => { stop(); observer.disconnect(); reject(new Error('No guard defeated: ' + node.dataset.targets + ' / ' + telemetry.dataset.enemies)); },45000);
    const observer = new MutationObserver(update); observer.observe(node,{ attributes: true,attributeFilter: ['data-targets'] }); update();
  }));
  const corpse = () => state(page).evaluate(n => JSON.parse(n.dataset.combat!).enemies.find((enemy: { id: string }) => enemy.id === 'guard-01'));
  await expect.poll(async () => (await corpse()).age, { timeout: 20000 }).toBeGreaterThan(1.4);
  const dead = await corpse(); expect(dead.transitions).toBe(1); expect(dead.collider).toBe(false); expect(dead.floorError).toBeLessThan(.02); expect(dead.height).toBeLessThan(1);
  const guard = () => page.getByTestId('arena-position').evaluate(n => JSON.parse(n.dataset.enemies!).find((enemy: { id: string }) => enemy.id === 'guard-01'));
  const defeated = await guard(); expect(defeated.state).toBe('DEAD'); expect(defeated.deaths).toBe(1); expect(dead.hits).toBe(3);
  await page.screenshot({ path: info.outputPath('guard-combat.png') });
  await expect.poll(async () => (await corpse()).visible, { timeout: 25000 }).toBe(false); expect((await guard()).shots).toBe(defeated.shots); expect((await guard()).deaths).toBe(1); expect((await corpse()).transitions).toBe(1);
  await writeFile(info.outputPath('metrics.json'),JSON.stringify(await state(page).evaluate(n => ({ ...n.dataset })),null,2));
});
test('mobile POV/zoom/quality controls survive resize and repeated scene teardown',async ({ browser },info) => {
  test.setTimeout(240000); const context = await browser.newContext({ viewport: { width: 390,height: 844 },hasTouch: true,isMobile: true,deviceScaleFactor: 2 }),page = await context.newPage();
  await page.goto(String(info.project.use.baseURL) + entry); await page.getByRole('button',{ name: 'ENTER 3D RAID' }).tap(); await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{ timeout: 90000 });
  await pov(page,'FIRST-PERSON / FPS'); await pov(page,'THIRD-PERSON / TPS'); await expect(state(page)).toHaveAttribute('data-pov','third');
  await page.getByRole('button',{ name: 'Pause game',exact: true }).tap(); await page.getByLabel('3D graphics quality').selectOption('balanced'); await page.getByRole('button',{ name: 'RESUME RAID' }).tap(); await page.getByRole('button',{ name: 'Camera zoom',exact: true }).tap();
  await page.screenshot({ path: info.outputPath('mobile-portrait.png') }); await page.setViewportSize({ width: 844,height: 390 });
  await expect(page.getByTestId('movement-stick')).toBeVisible(); await expect(page.getByTestId('aim-stick')).toBeVisible(); await page.screenshot({ path: info.outputPath('mobile-landscape.png') });
  for (let i = 0; i < 2; i++) { await page.getByRole('button',{ name: 'Pause game',exact: true }).tap(); await page.getByRole('button',{ name: 'RESTART 3D RAID' }).tap(); await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{ timeout: 90000 }); await expect(page.locator('canvas')).toHaveCount(1); await expect(state(page)).toHaveAttribute('data-pov','tactical'); }
  await page.getByRole('button',{ name: 'Pause game',exact: true }).tap(); await page.getByRole('button',{ name: 'EXIT SANDBOX' }).tap(); await expect(page.locator('canvas')).toHaveCount(0); await context.close();
});
