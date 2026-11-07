import { selectPOV } from './controls';
import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const state = (page: Page) => page.getByTestId('three-state');
async function combat(page: Page) { return JSON.parse((await state(page).getAttribute('data-combat')) || 'null'); }
async function enter(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'ENTER 3D RAID' }).click(); await expect(page.locator('.r3-game')).toHaveAttribute('data-status', 'playing', { timeout: 90000 }); }

test('hand sockets, real muzzle shots, audio and reload survive all four POVs', async ({ page }, info) => {
  // The environment pack is also exercised on software WebGL runners. Keep
  // every alignment/reload assertion; allow time for all four rendered views.
  test.setTimeout(420000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await enter(page);
  await expect(page.getByRole('button', { name: 'Mute ambient audio' })).toBeVisible();
  await expect.poll(async () => (await combat(page)).audio.buffers, { timeout: 30000 }).toBe(18);
  await expect.poll(async () => (await combat(page)).audio.state).toBe('running');
  const run = await state(page).getAttribute('data-run');
  for (const [id, label] of [['tactical','TACTICAL / TOP-DOWN'], ['side','ACTION / SIDE-VIEW'], ['third','THIRD-PERSON / TPS'], ['first','FIRST-PERSON / FPS']] as const) {
    await selectPOV(page,label);
    await expect(state(page)).toHaveAttribute('data-pov', id); await expect(state(page)).toHaveAttribute('data-run', run!);
    await expect.poll(async () => (await combat(page)).ready).toBe(true);
    const before = (await combat(page)).lastShot?.serial ?? 0;
    await page.mouse.click(920, 450);
    await expect.poll(async () => (await combat(page)).lastShot?.serial).toBeGreaterThan(before);
    const c = await combat(page); await writeFile(info.outputPath(id + '-combat.json'), JSON.stringify(c, null, 2));
    expect(c.grip).toBeLessThan(.001); expect(c.supported).toBe(true); expect(c.support).toBeLessThan(.045); expect(c.alignment).toBeGreaterThan(.985);
    const shot = c.lastShot; expect(shot.blocked).toBe(false); expect(Math.hypot(...shot.origin.map((v: number, i: number) => v - shot.muzzle[i]))).toBeLessThan(.001);
    expect(c.effects.flashes).toBeGreaterThan(before); expect(c.effects.traces).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath(id + '-weapon.png') });
    if (id === 'first') {
      expect((await combat(page)).view.hands).toBe(true);
      await page.getByRole('button', { name: 'Aim down sights',exact: true }).hover(); await page.mouse.down();
      await expect.poll(async () => (await combat(page)).view.ads).toBe(true);
      await expect.poll(async () => Math.abs((await combat(page)).view.sight[0])).toBeLessThan(.01);
      await expect.poll(async () => Math.abs((await combat(page)).view.sight[1])).toBeLessThan(.02);
      expect((await combat(page)).view.fov).toBeLessThan(60); await page.screenshot({ path: info.outputPath('first-ads.png') }); await page.mouse.up();
    }
  }
  await page.keyboard.press('r'); await expect.poll(async () => Number(await page.getByTestId('arena-position').getAttribute('data-ammo')), { timeout: 15000 }).toBe(12);
  await expect.poll(async () => (await combat(page)).audio.played).toBeGreaterThan(4);
  await expect.poll(async () => (await combat(page)).audio.peak).toBeGreaterThan(0);
  expect((await combat(page)).audio.errors).toBe(0); expect((await combat(page)).audio.voices).toBeLessThanOrEqual(16);
  await page.getByRole('button', { name: 'Mute ambient audio' }).click(); await expect.poll(async () => (await combat(page)).audio.voices).toBe(0);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click(); await page.getByRole('button', { name: 'EXIT SANDBOX' }).click(); await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('sustained fire and automatic reload keep GPU and effect pools bounded', async ({ page }, info) => {
  test.setTimeout(180000); await enter(page);
  // Warm the real tracer and sprite GPU uploads before comparing subsequent
  // magazines. First-use geometry/texture registration is not a leak.
  await page.mouse.click(920,450); await expect.poll(async () => (await combat(page)).effects.impacts).toBeGreaterThan(0);
  await expect.poll(async () => (await combat(page)).effects.particles).toBe(0);
  const baseline = await state(page).evaluate(n => ({ geometry: Number(n.dataset.geometries), textures: Number(n.dataset.textures) }));
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const node = document.querySelector<HTMLElement>('[data-testid=arena-position]')!, canvas = document.querySelector('canvas')!;
    const stop = () => window.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
    const observer = new MutationObserver(() => { if (Number(node.dataset.shots) >= 36) { stop(); observer.disconnect(); clearTimeout(timer); resolve(); } });
    const timer = setTimeout(() => { stop(); observer.disconnect(); reject(new Error('Sustained firing did not complete')); }, 90000);
    observer.observe(node, { attributes: true, attributeFilter: ['data-shots'] }); canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: innerWidth * .6, clientY: innerHeight * .6, bubbles: true }));
  }));
  await expect.poll(async () => (await combat(page)).effects.particles, { timeout: 15000 }).toBe(0);
  const after = await state(page).evaluate(n => ({ geometry: Number(n.dataset.geometries), textures: Number(n.dataset.textures) }));
  expect(after.geometry).toBe(baseline.geometry); expect(after.textures).toBe(baseline.textures); expect((await combat(page)).effects.trails).toBe(0); expect((await combat(page)).audio.state).toBe('running');
  await writeFile(info.outputPath('sustained-fire.json'), JSON.stringify({ baseline, after, combat: await combat(page) }, null, 2));
  await page.getByRole('button', { name: 'Pause game', exact: true }).click(); await page.getByRole('button', { name: 'EXIT SANDBOX' }).click(); await expect(page.locator('canvas')).toHaveCount(0);
});
