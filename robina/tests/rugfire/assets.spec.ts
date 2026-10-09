import { test, expect } from '@playwright/test';
import type { RugfireEngine } from '../../src/features/rugfire/engine';
type Scope = Window & { engine: RugfireEngine & { animation: number; updatePlayer(dt: number): void }; THREE: typeof import('three') };

test('supplied human, animations, weapons, vegetation and pickups are playable without missing assets', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', response => { if (response.url().includes('/assets/rugfire/') && !response.ok()) failures.push(response.url()); });
  page.on('pageerror', error => failures.push(error.message));
  await page.addInitScript(() => Object.defineProperty(window, 'devicePixelRatio', { value: .5 }));
  await page.goto('/tests/rugfire/index.html?engine');
  await page.waitForFunction(() => (window as Scope).engine?.snapshot().assetsReady);
  const result = await page.evaluate(async () => {
    const { engine: e, THREE: T } = window as Scope;
    cancelAnimationFrame(e.animation);
    let skinned = 0; e.player.body!.traverse(o => { if (o instanceof T.SkinnedMesh) skinned++; });
    const hand = e.player.body!.getObjectByName('RightHand')!;
    const start = hand.position.clone();
    const fire = e.player.actions.get('Fire')!; e.player.mixer!.stopAllAction(); fire.reset().play(); e.player.mixer!.update(.1);
    const poseValid = hand.getWorldPosition(new T.Vector3()).toArray().every(Number.isFinite);
    e.runtime.mode = 'active'; const weapons = [];
    for (const id of ['pistol', 'smg', 'rifle'] as const) { e.setWeapon(id); weapons.push([...e.player.weapons].filter(([, model]) => model.visible).map(([id]) => id)); }
    e.runtime.health = 40; e.player.root.position.set(-4.3, 0, -12); e.updatePlayer(.016); const healed = e.runtime.health;
    e.updatePlayer(.016); const noDoublePickup = e.runtime.health === healed;
    const ammo = e.runtime.ammo.rifle.reserve; e.player.root.position.set(2.3, 0, 7); e.updatePlayer(.016);
    await e.audio.unlock();
    const output = { skinned, clips: e.player.actions.size, attached: e.player.weapon.parent === hand, poseValid, start: start.toArray(), weapons, healed, noDoublePickup, ammoAdded: e.runtime.ammo.rifle.reserve - ammo, grass: !!e.scene.getObjectByName('wind-grass'), enemies: e.enemies.every(enemy => enemy.actor.mounted), draws: e.renderer.info.render.calls };
    e.dispose(); return output;
  });
  expect(result.skinned).toBe(1); expect(result.clips).toBe(10); expect(result.attached).toBe(true); expect(result.poseValid).toBe(true);
  expect(result.weapons).toEqual([['pistol'], ['smg'], ['rifle']]); expect(result.healed).toBe(80); expect(result.noDoublePickup).toBe(true);
  expect(result.ammoAdded).toBe(60); expect(result.grass).toBe(true); expect(result.enemies).toBe(true); expect(failures).toEqual([]);
});

test('a missing model gives a recoverable error and never starts invisible combat', async ({ page }) => {
  await page.route('**/assets/rugfire/characters/operator.glb*', route => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/tests/rugfire/index.html');
  await expect(page.getByRole('alert')).toContainText('Mission assets could not be prepared', { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'ENTER OPERATION' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'RESTART GRAPHICS' })).toBeVisible();
  await expect(page.locator('.rf-reticle')).toHaveCount(0);
});

test('leaving during asset preparation removes the canvas and suppresses late callbacks', async ({ page }) => {
  await page.route('**/assets/rugfire/**', route => route.abort());
  await page.goto('/tests/rugfire/index.html?engine');
  const result = await page.evaluate(async () => {
    const e = (window as Scope).engine; e.dispose(); await e.ready;
    return { canvases: document.querySelectorAll('canvas').length, models: e.assets.models.size, mode: e.runtime.mode };
  });
  expect(result).toEqual({ canvases: 0, models: 0, mode: 'briefing' });
});
