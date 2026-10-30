import { expect, type Page } from '@playwright/test';

export const state = (page: Page) => page.getByTestId('arena-position');
// Release keys inside the browser at the telemetry threshold, avoiding host latency.
export async function move(page: Page, axis: 'x' | 'y', destination: number, tolerance = 18) {
  await page.evaluate(({ axis, destination, tolerance }) => new Promise<void>((resolve, reject) => {
    const node = document.querySelector<HTMLElement>('[data-testid="arena-position"]')!;
    const start = Number(node.dataset[axis]), sign = Math.sign(destination - start);
    if (Math.abs(destination - start) < tolerance) { resolve(); return; }
    const code = axis === 'x' ? sign > 0 ? 'KeyD' : 'KeyA' : sign > 0 ? 'KeyS' : 'KeyW';
    const stop = () => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    const observer = new MutationObserver(() => {
      if ((Number(node.dataset[axis]) - destination) * sign >= -tolerance) { stop(); observer.disconnect(); clearTimeout(timer); resolve(); }
    });
    const timer = setTimeout(() => { stop(); observer.disconnect(); reject(new Error('Traversal blocked: ' + axis + ' -> ' + destination + ', reached ' + node.dataset[axis])); }, 30000);
    observer.observe(node, { attributes: true, attributeFilter: ['data-' + axis] });
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  }), { axis, destination, tolerance });
  await expect(state(page)).toHaveAttribute('data-speed', '0.00', { timeout: 15000 });
}
export async function interact(page: Page, name: string) {
  await expect(state(page)).not.toHaveAttribute('data-animation', 'interact');
  await expect(page.getByLabel('Nearby equipment', { exact: true })).toContainText(name);
  await page.keyboard.press('e'); await page.waitForTimeout(350);
}
export async function aim(page: Page, x: number, y: number) {
  await page.waitForTimeout(400);
  const data = await state(page).evaluate(node => ({ ...node.dataset }));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + (x - Number(data.viewX)) * Number(data.cameraZoom), box.y + (y - 44 - Number(data.viewY)) * Number(data.cameraZoom));
}

/** Aim at the rendered enemy and fire real input; never change game state from a test. */
export async function defeat(page: Page, id: string) {
  await page.evaluate(id => new Promise<void>((resolve, reject) => {
    const node = document.querySelector<HTMLElement>('[data-testid="arena-position"]')!;
    const canvas = document.querySelector('canvas')!;
    const release = () => window.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
    const update = () => {
      const enemy = (JSON.parse(node.dataset.enemies || '[]') as { id: string; x: number; y: number; health: number }[]).find(e => e.id === id);
      if (!enemy || !enemy.health) { release(); observer.disconnect(); clearTimeout(timer); resolve(); return; }
      const box = canvas.getBoundingClientRect(), zoom = Number(node.dataset.cameraZoom);
      const clientX = box.x + (enemy.x - Number(node.dataset.viewX)) * zoom;
      const clientY = box.y + (enemy.y - 44 - Number(node.dataset.viewY)) * zoom;
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true }));
      canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX, clientY, bubbles: true }));
    };
    const timer = setTimeout(() => { release(); observer.disconnect(); reject(new Error('Could not defeat ' + id + ': ' + node.dataset.enemies + ', player HP=' + node.dataset.health)); }, 60000);
    const observer = new MutationObserver(update); observer.observe(node, { attributes: true, attributeFilter: ['data-enemies'] }); update();
  }), id);
}

export async function breach(page: Page, wrongFirst = false, touch = false) {
  await interact(page, 'Sector access terminal');
  const dialog = page.getByRole('dialog', { name: 'Break the handshake.' });
  await expect(dialog).toBeVisible();
  if (wrongFirst) {
    await page.getByRole('button', { name: 'Signal pad 1', exact: true })[touch ? 'tap' : 'click']();
    await expect(page.getByRole('heading', { name: 'Signal rejected.' })).toBeVisible();
    await expect(state(page)).toHaveAttribute('data-hacks', '0');
    await expect(state(page)).toHaveAttribute('data-alarm', 'true');
    await page.getByRole('button', { name: 'RETRY HANDSHAKE' })[touch ? 'tap' : 'click']();
  }
  for (const pad of [2, 4, 1, 3]) await page.getByRole('button', { name: 'Signal pad ' + pad, exact: true })[touch ? 'tap' : 'click']();
  await expect(page.getByRole('heading', { name: 'Access granted.' })).toBeVisible();
  await expect(state(page)).toHaveAttribute('data-hacks', '1');
  await expect(state(page)).toHaveAttribute('data-disabled', 'vault-grid,optics-b');
}

/** A test player reads visible telemetry and uses normal movement, aim, fire and dodge input. */
export async function fightGuardian(page: Page) {
  return page.evaluate(() => new Promise<{ phase: string; fps: number; p95: number }[]>((resolve,reject) => {
    const node = document.querySelector<HTMLElement>('[data-testid="arena-position"]')!, canvas = document.querySelector('canvas')!;
    let previousState = '', movement: string[] = [], phase = 'A', phaseAttacks = 0, lastFPS = '';
    const samples: { phase: string; fps: number; p95: number }[] = [];
    const key = (code: string,down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup',{ code,bubbles: true }));
    const steer = (codes: string[]) => { movement.filter(code => !codes.includes(code)).forEach(code => key(code,false)); codes.filter(code => !movement.includes(code)).forEach(code => key(code,true)); movement = codes; };
    const fire = (down: boolean,clientX = 0,clientY = 0) => (down ? canvas : window).dispatchEvent(new PointerEvent(down ? 'pointerdown' : 'pointerup',{ button: 0,clientX,clientY,bubbles: true }));
    const done = (error?: string) => { steer([]); fire(false); observer.disconnect(); clearTimeout(timer); if (error) reject(new Error(error)); else resolve(samples); };
    const update = () => {
      const b = JSON.parse(node.dataset.boss || 'null') as { state: string; phase: string; x: number; y: number; angle: number; health: number; ability: string; remaining: number; attacks: Record<string,number> } | null;
      if (!b || b.state === 'DORMANT' || b.state === 'INTRO') return;
      if (b.state === 'DEFEATED') { done(); return; }
      if (node.dataset.fps && node.dataset.fps !== lastFPS) { lastFPS = node.dataset.fps; samples.push({ phase: b.phase,fps: Number(node.dataset.fps),p95: Number(node.dataset.p95) }); }
      if (Number(node.dataset.health) <= 0) { done('Guardian defeated test player: ' + JSON.stringify(b)); return; }
      const x = Number(node.dataset.x), y = Number(node.dataset.y), count = Object.values(b.attacks).reduce((sum,n) => sum + n,0);
      if (phase !== b.phase) { phase = b.phase; phaseAttacks = count; }
      const waitForPatterns = phase === 'B' ? b.attacks.pulse === 0 || b.attacks.reposition === 0 : phase === 'C' ? count < phaseAttacks + 2 : false;
      const box = canvas.getBoundingClientRect(), zoom = Number(node.dataset.cameraZoom);
      const clientX = box.x + (b.x - Number(node.dataset.viewX)) * zoom, clientY = box.y + (b.y - 44 - Number(node.dataset.viewY)) * zoom;
      canvas.dispatchEvent(new PointerEvent('pointermove',{ clientX,clientY,bubbles: true }));
      fire(!waitForPatterns && !['TRANSITION','STAGGERED'].includes(b.state),clientX,clientY);
      if (b.state === 'WINDUP') {
        if (previousState !== 'WINDUP') {
          let dx = -Math.sin(b.angle), dy = Math.cos(b.angle);
          if (y + dy * 150 < 110 || y + dy * 150 > 400 || x + dx * 150 < 1120 || x + dx * 150 > 1660) { dx *= -1; dy *= -1; }
          const codes: string[] = [];
          if (Math.abs(dx) > .3) codes.push(dx > 0 ? 'KeyD' : 'KeyA');
          if (Math.abs(dy) > .3) codes.push(dy > 0 ? 'KeyS' : 'KeyW');
          steer(codes);
        }
        if (b.remaining < .25 && Number(node.dataset.cooldown) === 0) { key('Space',true); key('Space',false); }
      } else if (b.state !== 'ACTIVE') {
        // Re-center between attacks rather than pinning the operative against a wall.
        const codes: string[] = [];
        if (y > 340) codes.push('KeyW'); else if (y < 140) codes.push('KeyS');
        if (x < 1160) codes.push('KeyD'); else if (x > 1650) codes.push('KeyA');
        steer(codes);
      }
      previousState = b.state;
    };
    const timer = setTimeout(() => done('Guardian fight timed out: ' + node.dataset.boss + ' player=' + node.dataset.health),150000);
    const observer = new MutationObserver(update); observer.observe(node,{ attributes: true,attributeFilter: ['data-boss'] }); update();
  }));
}

export async function reachGuardian(page: Page) {
  await move(page,'y',576); await move(page,'x',576); await interact(page,'Transit shutter');
  await move(page,'x',800); await defeat(page,'guard-01');
  await move(page,'x',864); await move(page,'y',672); await move(page,'x',976);
  await breach(page); await page.getByRole('button',{ name: 'RETURN TO FIELD' }).click();
  await move(page,'y',760); await defeat(page,'enforcer-01');
  await move(page,'x',864); await move(page,'y',920);
  await expect.poll(async () => { const d = await state(page).evaluate(n => ({ ...n.dataset })); return d.phase === 'ACTIVE' && Number(d.phaseWindow) > 4; },{ timeout: 30000,intervals: [100] }).toBe(true);
  await interact(page,'Phase pad WEST'); await move(page,'x',1024); await interact(page,'Phase pad EAST');
  await move(page,'x',944); await move(page,'y',576); await move(page,'x',1088); await move(page,'y',560);
  await interact(page,'Restricted sector door'); await move(page,'y',208); await defeat(page,'heavy-01');
  await move(page,'y',320); await move(page,'x',1184); await interact(page,'Vault relay A');
  await move(page,'y',272); await move(page,'x',1504); await move(page,'y',336,8); await interact(page,'Vault relay B');
}
