import { test, expect } from '@playwright/test';
import type { RugfireEngine, EnemyActor } from '../../src/features/rugfire/engine';
import type { Vector3 } from 'three';
type Probe = Omit<RugfireEngine, 'runtime'> & { runtime: RugfireEngine['runtime']; animation: number; updatePlayer(dt: number): void; updateMission(): void; updateBoss(dt: number): void; updateEnemies(dt: number): void; updateProjectiles(dt: number): void; enemyShot(enemy: EnemyActor): void; shoot(): void; hazards: { age: number; active: boolean; mesh: { position: Vector3 } }[] };
type Scope = Window & { engine: Probe; THREE: typeof import('three'); physics: typeof import('../../src/features/rugfire/physics') };
test('real UI: enter, aim, fire, switch, reload, pause, retry and return', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, 'devicePixelRatio', { value: .5 }));
  await page.goto('/tests/rugfire/index.html');
  await expect(page.getByRole('button', { name: 'ENTER OPERATION' })).toBeVisible();
  await page.screenshot({ path: 'test-results/rugfire-briefing.png' });
  await page.getByRole('button', { name: 'ENTER OPERATION' }).click();
  await expect(page.locator('.rf-reticle')).toBeVisible();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(650); await page.keyboard.up('KeyW');
  await page.mouse.down({ button: 'right' }); await expect(page.locator('.rf-reticle')).toHaveClass(/aiming/);
  await page.mouse.down({ button: 'left' });
  await expect(page.locator('.rf-weapon strong')).not.toHaveText('30', { timeout: 15000 });
  await page.mouse.up({ button: 'left' }); await page.mouse.up({ button: 'right' });
  await page.keyboard.press('KeyR'); await expect(page.locator('.rf-reload')).toBeVisible();
  await page.keyboard.press('Digit2'); await expect(page.locator('.rf-weapon>span')).toHaveText('SLIPSTREAM / SMG');
  await expect(page.locator('.rf-reload')).toHaveCount(0);
  await page.keyboard.press('Space'); await expect(page.locator('.rf-dodge b')).not.toHaveText('READY');
  await page.screenshot({ path: 'test-results/rugfire-combat.png' });
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.getByRole('button', { name: 'RESUME OPERATION' })).toBeVisible();
  await page.getByRole('button', { name: 'RESTART OPERATION' }).click();
  await expect(page.getByRole('button', { name: 'ENTER OPERATION' })).toBeVisible();
  await page.getByRole('button', { name: 'ENTER OPERATION' }).click();
  await expect(page.locator('.rf-weapon strong')).toHaveText('30');
  await page.evaluate(() => document.exitPointerLock());
  await page.getByRole('button', { name: 'RETURN TO BASE' }).click();
  await expect(page.getByText('OPERATOR BASE')).toBeVisible();
  expect(errors).toEqual([]);
});
test('complete operation through actual gunfire, interaction, boss phases and extraction', async ({ page }) => {
  await page.goto('/tests/rugfire/index.html?engine');
  await page.waitForFunction(() => Boolean((window as Scope).engine?.snapshot().assetsReady));
  const result = await page.evaluate(() => {
    const w = window as Scope, e = w.engine, r = e.runtime, V = w.THREE.Vector3;
    cancelAnimationFrame(e.animation); r.mode = 'active';
    const assertions: string[] = [];
    const check = (condition: boolean, name: string) => { if (!condition) throw new Error(name); assertions.push(name); };
    const startingZ = e.player.root.position.z;
    e.input.keys.add('KeyW'); e.updatePlayer(.2); e.input.keys.clear();
    check(e.player.root.position.z < startingZ, 'forward movement');
    const startingX = e.player.root.position.x;
    e.input.keys.add('KeyD'); e.updatePlayer(.2); e.input.keys.clear();
    check(e.player.root.position.x > startingX, 'right strafe');
    e.input.fire = false; e.input.firePressed = true; e.updatePlayer(.016); check(r.shots === 1, 'quick click retained between frames'); r.tick(.2);
    e.player.root.position.set(0, 0, 3); e.updateMission(); check(r.stage === 1, 'launch district trigger');
    const eliminate = (enemy: EnemyActor, stopAt = 0) => {
      let fired = 0;
      for (let angle = 0; angle < 12 && enemy.hp > stopAt; angle++) {
        const a = angle * Math.PI / 6, p = new V(enemy.actor.root.position.x + Math.sin(a) * 8, 0, enemy.actor.root.position.z + Math.cos(a) * 8);
        if (Math.abs(p.x) > 10.7 || e.world.colliders.some(c => c.box.min.y <= 1.65 && c.box.max.y >= 0 && p.x > c.box.min.x - .4 && p.x < c.box.max.x + .4 && p.z > c.box.min.z - .4 && p.z < c.box.max.z + .4)) continue;
        e.player.root.position.copy(p);
        const target = enemy.actor.root.position.clone(); target.y += 1.62 * enemy.actor.root.scale.x;
        e.player.root.rotation.y = Math.atan2(p.x - target.x, p.z - target.z); e.player.root.updateMatrixWorld(true);
        e.camera.position.copy(p).add(new V(.1, 1.8, .3)); e.camera.lookAt(target); e.camera.updateMatrixWorld();
        const before = enemy.hp;
        for (let i = 0; i < 60 && enemy.hp > stopAt; i++) {
          r.tick(.2); if (!r.ammo.rifle.magazine) { r.reload(); r.tick(2); }
          e.shoot(); fired++; e.updateBoss(.01);
          if (i > 3 && enemy.hp === before) break;
        }
      }
      check(enemy.hp <= stopAt, enemy.id + ' defeated by rays (' + fired + ' shots)');
    };
    for (const stage of [1, 2, 3]) {
      check(r.stage === stage, 'stage ' + stage + ' activated');
      for (const enemy of e.enemies.filter(enemy => enemy.stage === stage)) eliminate(enemy);
      e.updateMission(); check(r.stage === stage + 1, 'stage ' + stage + ' cleared');
    }
    for (const enemy of e.enemies.filter(enemy => enemy.stage === 4)) eliminate(enemy);
    e.player.root.position.copy(e.world.terminal).add(new V(0, 0, 1.3)); e.updateMission();
    check(e.snapshot().interact.length > 0, 'terminal interaction available');
    e.input.pressed.add('KeyE'); e.updatePlayer(.016); check(r.stage === 5, 'liquidity operation disabled');
    const boss = e.enemies.find(enemy => enemy.role === 'boss')!;
    eliminate(boss, 620); e.updateBoss(.1); check(e.enemies.some(enemy => enemy.id === 'reinforce-a'), 'reinforcement phase');
    eliminate(boss, 390); for (let i = 0; i < 100 && !e.hazards.some(h => h.active); i++) e.updateBoss(.1); check(e.hazards.some(h => h.active), 'drain phase telegraphed');
    r.health = 100; e.player.root.position.copy(e.hazards[0].mesh.position); for (let i = 0; i < 22; i++) e.updateBoss(.1); check(r.health < 100, 'active drain damages');
    e.player.root.position.set(0, 0, -59); eliminate(boss, 160); check(e.snapshot().bossPhase.includes('LAST STAND'), 'aggression phase');
    eliminate(boss); e.updateBoss(.1); check(r.stage === 6, 'boss death starts extraction');
    e.player.root.position.copy(e.world.extraction); e.updateMission(); check(r.mode === 'complete', 'extraction completes mission');
    check(r.rewards.xp === 1800 && r.rewards.credits === 650, 'report rewards');
    const final = { mode: r.mode, kills: r.kills, shots: r.shots, hits: r.hits, stages: r.stage, assertions };
    e.dispose(); return final;
  });
  expect(result.mode).toBe('complete'); expect(result.kills).toBeGreaterThanOrEqual(9); expect(result.hits).toBeGreaterThan(20);
  console.log(JSON.stringify(result));
});
test('enemy attacks require line of sight, sniper telegraphs and death stops combat', async ({ page }) => {
  await page.goto('/tests/rugfire/index.html?engine'); await page.waitForFunction(() => Boolean((window as Scope).engine?.snapshot().assetsReady));
  const result = await page.evaluate(() => {
    const w = window as Scope, e = w.engine, r = e.runtime;
    cancelAnimationFrame(e.animation); r.mode = 'active'; r.stage = 3;
    const whale = e.enemies.find(enemy => enemy.role === 'whale')!;
    e.player.root.position.set(1, 0, -31); whale.cooldown = 0; e.updateEnemies(.12);
    const warning = whale.warning > 0; const unchanged = r.health === 100;
    whale.target.copy(e.player.root.position); whale.target.y += 1; e.enemyShot(whale);
    for (let i = 0; i < 120; i++) e.updateProjectiles(.016);
    const exposedDamage = r.damageReceived;
    const kol = e.enemies.find(enemy => enemy.role === 'kol')!;
    kol.actor.root.position.set(-2.5, 0, -2); kol.target.set(-2.5, 1.1, 5); e.player.root.position.set(-2.5, 0, 5); r.health = 100; const previous = r.damageReceived;
    e.enemyShot(kol); for (let i = 0; i < 100; i++) e.updateProjectiles(.016);
    const coverBlocked = previous === r.damageReceived;
    r.damage(100, 'boss'); const before = r.shots; e.shoot(); const noDeadShots = before === r.shots;
    e.dispose(); return { warning, unchanged, exposedDamage, coverBlocked, noDeadShots, mode: r.mode };
  });
  expect(result.warning).toBe(true); expect(result.unchanged).toBe(true); expect(result.exposedDamage).toBeGreaterThan(0);
  expect(result.coverBlocked).toBe(true); expect(result.noDeadShots).toBe(true); expect(result.mode).toBe('rugged');
});





test('graphics context loss offers a working restart', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, 'devicePixelRatio', { value: .5 }));
  await page.goto('/tests/rugfire/index.html');
  await expect(page.getByRole('button', { name: 'ENTER OPERATION' })).toBeEnabled({ timeout: 60000 });
  await page.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(page.getByRole('alert')).toContainText('Graphics context lost');
  await page.getByRole('button', { name: 'RESTART GRAPHICS' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ENTER OPERATION' })).toBeEnabled();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'ENTER OPERATION' }).click();
  await expect(page.locator('.rf-reticle')).toBeVisible();
  expect(errors).toEqual([]);
});

test('fixed-step simulation, bounded lighting and safe graphics failure', async ({ page }) => {
  await page.goto('/tests/rugfire/index.html?engine');
  await page.waitForFunction(() => Boolean((window as Scope).engine?.snapshot().assetsReady));
  const result = await page.evaluate(() => {
    const w = window as Scope & { engineError?: string };
    const e = w.engine as typeof w.engine & { frame(time: number): void; last: number; accumulator: number };
    cancelAnimationFrame(e.animation);
    const actualDrawCalls = e.renderer.info.render.calls;
    e.renderer.render = () => {};
    e.runtime.mode = 'active'; e.last = 0; e.accumulator = 0;
    e.frame(1000); cancelAnimationFrame(e.animation);
    const before = e.runtime.time;
    e.frame(1100); cancelAnimationFrame(e.animation);
    const step = e.runtime.time - before;
    let meshes = 0; e.player.root.traverse(object => { if ((object as { isMesh?: boolean }).isMesh) meshes++; });
    const lightCount = e.world.lights.filter(light => light.visible).length;
    e.renderer.render = () => { throw new Error('simulated graphics failure'); };
    e.frame(1200);
    const recovered = e.runtime.mode === 'paused' && !!w.engineError;
    e.dispose(); e.dispose();
    return { step, meshes, lightCount, actualDrawCalls, recovered, canvases: document.querySelectorAll('canvas').length };
  });
  expect(result.step).toBeGreaterThan(.075); expect(result.step).toBeLessThanOrEqual(.101);
  expect(result.meshes).toBeLessThan(30); expect(result.lightCount).toBeLessThanOrEqual(4);
  expect(result.recovered).toBe(true); expect(result.canvases).toBe(0);
  console.log(JSON.stringify(result));
});

test('a delayed start cannot revive a disposed engine', async ({ page }) => {
  await page.goto('/tests/rugfire/index.html?engine');
  await page.waitForFunction(() => Boolean((window as Scope).engine?.snapshot().assetsReady));
  const result = await page.evaluate(async () => {
    const w = window as Scope & { engineError?: string }, e = w.engine;
    let resolveLock!: () => void;
    e.input.lock = () => new Promise<void>(resolve => { resolveLock = resolve; });
    const starting = e.start();
    e.dispose(); resolveLock(); await starting;
    return { mode: e.runtime.mode, error: w.engineError, canvases: document.querySelectorAll('canvas').length };
  });
  expect(result.mode).toBe('briefing'); expect(result.error).toBeUndefined(); expect(result.canvases).toBe(0);
});

test('an older audio unlock cannot suspend a newly resumed operation', async ({ page }) => {
  await page.goto('/tests/rugfire/index.html?engine');
  await page.waitForFunction(() => Boolean((window as Scope).engine?.snapshot().assetsReady));
  const result = await page.evaluate(async () => {
    const e = (window as Scope).engine;
    cancelAnimationFrame(e.animation);
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: e.renderer.domElement });
    e.input.lock = async () => {};
    const unlocks: ((available: boolean) => void)[] = [];
    let suspends = 0;
    e.audio.unlock = () => new Promise<boolean>(resolve => unlocks.push(resolve));
    e.audio.suspend = () => { suspends++; };
    await e.start(); e.pause(); await e.start();
    unlocks[1](true); await Promise.resolve();
    const before = suspends;
    unlocks[0](true); await Promise.resolve();
    const active = e.runtime.mode === 'active';
    delete (document as unknown as Record<string, unknown>).pointerLockElement;
    e.dispose();
    return { active, extraSuspends: suspends - before };
  });
  expect(result.active).toBe(true); expect(result.extraSuspends).toBe(0);
});
