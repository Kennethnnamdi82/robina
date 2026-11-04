import { selectPOV } from './controls';
import { expect,test,type Page } from '@playwright/test';
import { move } from '../rivals/traversal';
import { writeFile } from 'node:fs/promises';
const telemetry = (p: Page) => p.getByTestId('arena-position');
const state = (p: Page) => p.getByTestId('three-state');
const combat = (p: Page) => state(p).evaluate(n => JSON.parse(n.dataset.combat!));
async function enter(page: Page) { await page.goto('/'); await page.getByRole('button',{ name: 'ENTER 3D RAID' }).click(); await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{ timeout: 90000 }); }
const camera = selectPOV;

test('soldier loadout, finite reserve, knife stance, pulse charge and clean four-POV HUD',async ({ page },info) => {
  test.setTimeout(240000); const errors: string[] = []; page.on('pageerror',e => errors.push(e.message)); await enter(page);
  await expect(page.getByLabel('Equipped loadout')).toBeVisible(); await expect(page.getByRole('button',{ name: /Equip Slot 3/ })).toBeVisible(); await expect(page.getByRole('button',{ name: 'Switch weapon',exact: true })).toHaveCount(0); await expect(page.getByRole('button',{ name: 'Reload weapon',exact: true })).toHaveCount(0);
  await page.mouse.click(900,430); await expect.poll(async () => (await combat(page)).inventory.slots[0].ammo).toBe(11);
  await page.keyboard.press('r'); await expect.poll(async () => (await combat(page)).inventory.slots[0].reserve).toBe(119);
  await page.keyboard.press('q'); await expect.poll(async () => (await combat(page)).inventory.active).toBe(1); await expect.poll(async () => (await combat(page)).ready).toBe(true);
  await page.mouse.click(900,430); await expect.poll(async () => (await combat(page)).inventory.slots[1].ammo).toBe(11);
  await page.keyboard.press('q'); await expect.poll(async () => (await combat(page)).inventory.active).toBe(2); await expect.poll(async () => (await combat(page)).ready).toBe(true);
  await page.mouse.click(900,430); await expect.poll(async () => (await combat(page)).inventory.shots).toBeGreaterThan(2); await expect(page.getByLabel('Ammunition reserve')).toContainText('CLOSE QUARTERS');
  await expect.poll(async () => (await combat(page)).inventory.action).toBe('idle'); await page.keyboard.press('q'); await expect.poll(async () => (await combat(page)).inventory.active).toBe(0);
  expect((await combat(page)).inventory.slots[0].ammo).toBe(12); expect((await combat(page)).inventory.slots[1].ammo).toBe(11);
  await expect.poll(async () => (await combat(page)).ready).toBe(true); await page.getByRole('button',{ name: 'Throw bomb' }).click(); await expect.poll(async () => (await combat(page)).field.thrown).toBe(1); await expect.poll(async () => (await combat(page)).field.exploded,{ timeout: 20000 }).toBe(1); expect((await combat(page)).field.quantity).toBe(2);
  for (const [id,label] of [['tactical','TACTICAL / TOP-DOWN'],['side','ACTION / SIDE-VIEW'],['third','THIRD-PERSON / TPS'],['first','FIRST-PERSON / FPS']] as const) {
    await camera(page,label); await expect(state(page)).toHaveAttribute('data-pov',id); await expect.poll(async () => (await combat(page)).ready).toBe(true);
    const before = (await combat(page)).lastShot?.serial ?? 0; await page.mouse.click(910,430); await expect.poll(async () => (await combat(page)).lastShot.serial).toBeGreaterThan(before);
    expect((await combat(page)).flashError).toBeLessThan(.000001); await page.screenshot({ path: info.outputPath(id + '-hud.png') });
  }
  await page.getByRole('button',{ name: 'Pause game',exact: true }).click(); await page.getByRole('button',{ name: 'EXIT SANDBOX' }).click(); expect(errors).toEqual([]);
});

test('weapon replacement is explicit, cancel preserves the pickup, full-health medkits stay in place',async ({ page },info) => {
  test.setTimeout(180000); await enter(page); await move(page,'y',576); await move(page,'x',416);
  await page.keyboard.press('e'); await expect(page.getByRole('dialog',{ name: 'Replace weapon' })).toBeVisible(); const before = (await combat(page)).inventory.slots;
  const elapsed = await telemetry(page).getAttribute('data-mission-elapsed'); await page.waitForTimeout(200); expect(await telemetry(page).getAttribute('data-mission-elapsed')).toBe(elapsed);
  await page.getByRole('button',{ name: 'Cancel',exact: true }).click(); expect((await combat(page)).inventory.slots).toEqual(before); expect((await combat(page)).field.pickups.find((p: { id: string }) => p.id === 'supply-smg').consumed).toBe(false);
  await page.keyboard.press('e'); await page.getByRole('button',{ name: /Replace Slot 2/ }).click(); await expect.poll(async () => (await combat(page)).inventory.slots[1].id).toBe('smg');
  expect((await combat(page)).inventory.slots[0]).toEqual(before[0]); expect((await combat(page)).inventory.slots[2]).toEqual(before[2]); expect((await combat(page)).field.pickups.find((p: { id: string }) => p.id === 'supply-smg').consumed).toBe(true);
  await move(page,'x',288); await move(page,'y',704); await expect(page.getByLabel('Nearby equipment',{ exact: true })).toContainText('Health Full.'); await page.keyboard.press('e');
  expect((await combat(page)).field.pickups.find((p: { id: string }) => p.id === 'supply-med').consumed).toBe(false); expect(await telemetry(page).getAttribute('data-health')).toBe('100');
  await page.screenshot({ path: info.outputPath('medkit-full.png') }); await writeFile(info.outputPath('replacement.json'),JSON.stringify(await combat(page),null,2));
});

test('two real touch sticks move, aim and fire; releasing aim stops fire; controls do not overlap',async ({ browser },info) => {
  test.setTimeout(240000); const context = await browser.newContext({ viewport: { width: 390,height: 844 },hasTouch: true,isMobile: true }),page = await context.newPage();
  try {
    await page.goto(String(info.project.use.baseURL) + '/'); await page.getByRole('button',{ name: 'ENTER 3D RAID' }).tap(); await expect(page.locator('.r3-game')).toHaveAttribute('data-status','playing',{ timeout: 90000 });
    await page.screenshot({ path: info.outputPath('mobile-portrait.png') }); await page.setViewportSize({ width: 844,height: 390 });
    const cdp = await context.newCDPSession(page),m = (await page.getByTestId('movement-stick').boundingBox())!,a = (await page.getByTestId('aim-stick').boundingBox())!;
    const movePoint = { id: 1,x: m.x + m.width / 2 + 12,y: m.y + m.height / 2 },aimPoint = { id: 2,x: a.x + a.width / 2,y: a.y + a.height / 2 - 30 };
    await cdp.send('Input.dispatchTouchEvent',{ type: 'touchStart',touchPoints: [movePoint,aimPoint] }); await expect.poll(async () => Number(await telemetry(page).getAttribute('data-shots'))).toBeGreaterThan(0); await expect.poll(async () => Number(await telemetry(page).getAttribute('data-speed'))).toBeGreaterThan(0);
    await cdp.send('Input.dispatchTouchEvent',{ type: 'touchEnd',touchPoints: [aimPoint] });
    await expect(telemetry(page)).toHaveAttribute('data-aiming','false');
    const shots = Number(await telemetry(page).getAttribute('data-shots')),time = Number(await telemetry(page).getAttribute('data-mission-elapsed'));
    await expect.poll(async () => Number(await telemetry(page).getAttribute('data-mission-elapsed')) - time).toBeGreaterThan(.35); expect(Number(await telemetry(page).getAttribute('data-shots'))).toBe(shots); expect(Number(await telemetry(page).getAttribute('data-speed'))).toBeGreaterThan(0);
    await cdp.send('Input.dispatchTouchEvent',{ type: 'touchEnd',touchPoints: [] }); await expect.poll(async () => Number(await telemetry(page).getAttribute('data-speed'))).toBe(0);
    const overlaps = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>('.rv-action-buttons button,.rv-sprint-control,[data-testid=movement-stick],[data-testid=aim-stick]')].filter(n => getComputedStyle(n).display !== 'none' && n.getClientRects().length && !n.hidden);
      const problems: string[] = []; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const a = nodes[i].getBoundingClientRect(),b = nodes[j].getBoundingClientRect(); if (Math.min(a.right,b.right) - Math.max(a.left,b.left) > 2 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 2) problems.push(nodes[i].getAttribute('aria-label') + '/' + nodes[j].getAttribute('aria-label')); } return problems;
    }); expect(overlaps).toEqual([]); await page.screenshot({ path: info.outputPath('mobile-landscape.png') });
    await camera(page,'THIRD-PERSON / TPS');
    for (const [width,height] of [[360,640],[320,568],[390,844]] as const) {
      await page.setViewportSize({ width,height });
      const layout = await page.evaluate(() => {
        const stick = document.querySelector<HTMLElement>('[data-testid=aim-stick]')!.getBoundingClientRect(),reload = document.querySelector<HTMLElement>('[aria-label="Throw bomb"]')!.getBoundingClientRect(),dock = document.querySelector<HTMLElement>('.r3-loadout')!.getBoundingClientRect();
        const controls = [...document.querySelectorAll<HTMLElement>('.rv-action-buttons button,.rv-sprint-control')].filter(n => getComputedStyle(n).display !== 'none' && n.getClientRects().length);
        const bad: string[] = []; for (let i = 0; i < controls.length; i++) { const a = controls[i].getBoundingClientRect(); if (a.left < 0 || a.right > innerWidth + 1 || a.top < 0 || a.bottom > innerHeight + 1 || a.width < 43 || a.height < 43) bad.push('bounds:' + controls[i].ariaLabel); for (let j = i + 1; j < controls.length; j++) { const b = controls[j].getBoundingClientRect(); if (Math.min(a.right,b.right) - Math.max(a.left,b.left) > 2 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 2) bad.push('overlap:' + controls[i].ariaLabel + '/' + controls[j].ariaLabel); } }
        return { bad,gap: stick.top - reload.bottom,centreClear: dock.bottom < innerHeight / 2 - 15 };
      }); expect(layout.bad).toEqual([]); expect(layout.gap).toBeGreaterThan(10); expect(layout.gap).toBeLessThan(60); expect(layout.centreClear).toBe(true); await page.screenshot({ path: info.outputPath(`mobile-${width}x${height}.png`) });
    }
    await page.getByRole('button',{ name: 'Pause game',exact: true }).tap(); await page.getByRole('button',{ name: 'EXIT SANDBOX' }).tap(); await expect(page.locator('canvas')).toHaveCount(0);
  } finally { await context.close(); }
});

test('real guard contact, directional knife kill, enemy weapon drop and healing use the shared raid',async ({ page },info) => {
  test.setTimeout(300000); await enter(page); await move(page,'y',576); await move(page,'x',576); await page.keyboard.press('e'); await move(page,'x',800); await move(page,'y',720);
  async function fireUntil(limit: number,chase = false) {
    await page.evaluate(({ maximum,chase }) => new Promise<void>((resolve,reject) => {
      const node = document.querySelector<HTMLElement>('[data-testid=three-state]')!,data = document.querySelector<HTMLElement>('[data-testid=arena-position]')!,canvas = document.querySelector('canvas')!;
      const held = new Set<string>(); const key = (code: string,on: boolean) => { if (held.has(code) === on) return; if (on) held.add(code); else held.delete(code); window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup',{ code,bubbles: true })); };
      const stop = () => { for (const code of [...held]) key(code,false); window.dispatchEvent(new PointerEvent('pointerup',{ button: 0,bubbles: true })); };
      const update = () => {
        const guard = JSON.parse(data.dataset.enemies!).find((e: { id: string }) => e.id === 'guard-01');
        if (guard.health <= maximum) { stop(); clearTimeout(timer); observer.disconnect(); resolve(); return; }
        if (chase) { const dx = guard.x - Number(data.dataset.x),dy = guard.y - Number(data.dataset.y); key('KeyD',dx > 28); key('KeyA',dx < -28); key('KeyS',dy > 28); key('KeyW',dy < -28); }
        const target = JSON.parse(node.dataset.targets!).find((e: { id: string }) => e.id === 'guard-01'); if (target?.visible) { const r = canvas.getBoundingClientRect(); canvas.dispatchEvent(new PointerEvent('pointermove',{ clientX: r.x + target.x,clientY: r.y + target.y,bubbles: true })); canvas.dispatchEvent(new PointerEvent('pointerdown',{ button: 0,clientX: r.x + target.x,clientY: r.y + target.y,bubbles: true })); }
      };
      const timer = setTimeout(() => { stop(); observer.disconnect(); reject(new Error('Guard health did not reach ' + maximum + ': ' + data.dataset.enemies)); },60000),observer = new MutationObserver(update); observer.observe(node,{ attributes: true,attributeFilter: ['data-targets'] }); update();
    }),{ maximum: limit,chase });
  }
  await fireUntil(50); await expect.poll(async () => Number(await telemetry(page).getAttribute('data-health')),{ timeout: 25000 }).toBeLessThan(100);
  const enemy = await telemetry(page).evaluate(n => JSON.parse(n.dataset.enemies!).find((e: { id: string }) => e.id === 'guard-01'));
  await move(page,'y',enemy.y); await move(page,'x',enemy.x - 40); await page.keyboard.press('3'); await expect.poll(async () => (await combat(page)).inventory.active).toBe(2); await expect.poll(async () => (await combat(page)).ready).toBe(true);
  await fireUntil(0,true); expect((await combat(page)).field.pickups.find((p: { id: string }) => p.id === 'guard-01:weapon').consumed).toBe(false);
  const knifeState = await combat(page); expect(knifeState.inventory.slots[2].kind).toBe('melee'); expect(knifeState.enemies[0].transitions).toBe(1); await page.screenshot({ path: info.outputPath('knife-guard-defeated.png') });
  const drop = knifeState.field.pickups.find((p: { id: string }) => p.id === 'guard-01:weapon'); await move(page,'y',drop.position[2] / .025); await move(page,'x',drop.position[0] / .025);
  await expect.poll(async () => (await combat(page)).inventory.action).toBe('idle'); // A closer health box may be collected first; wait for its pickup action before collecting the weapon.
  await page.keyboard.press('e');
  if (!(await page.getByRole('dialog',{ name: 'Replace weapon' }).isVisible())) {
    await expect.poll(async () => (await combat(page)).inventory.action).toBe('idle');
    await expect(page.getByLabel('Nearby equipment',{ exact: true })).toContainText('KESTREL');
    await page.keyboard.press('e');
  }
  await expect(page.getByRole('dialog',{ name: 'Replace weapon' })).toBeVisible(); await page.getByRole('button',{ name: /Replace Slot 3/ }).click(); await expect.poll(async () => (await combat(page)).inventory.slots[2].id).toBe('pistol');
  await move(page,'x',800); await move(page,'y',576); await move(page,'x',576); await move(page,'x',288); await move(page,'y',704); const hp = Number(await telemetry(page).getAttribute('data-health')); expect(hp).toBeGreaterThan(0); expect(hp).toBeLessThan(100);
  await page.keyboard.press('e'); await expect.poll(async () => Number(await telemetry(page).getAttribute('data-health'))).toBe(Math.min(100,hp + 40)); expect((await combat(page)).field.pickups.find((p: { id: string }) => p.id === 'supply-med').consumed).toBe(true);
  await writeFile(info.outputPath('knife-and-heal.json'),JSON.stringify(await combat(page),null,2));
});
