import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page, response: 'unauthorized' | 'stalled' | 'html' | 'authenticated' | 'admin') {
  // Optional infrastructure-only cookie for the owning account's protected
  // staged deployment. Never creates an application login or account token.
  if (process.env.PRODUCTION_TEST_BYPASS_COOKIE) {
    const cookie = JSON.parse(process.env.PRODUCTION_TEST_BYPASS_COOKIE);
    if (new URL(cookie.url).origin !== new URL(test.info().project.use.baseURL!).origin) throw new Error('Staging cookie target mismatch');
    await page.context().addCookies([cookie]);
  }
  const errors: string[] = []; page.on('pageerror', error => { errors.push(error.message); console.log('Production startup error: ' + error.message); });
  await page.addInitScript(() => Object.defineProperty(window, 'devicePixelRatio', { value: .5 }));
  // Isolate the app from live auth/payment services; no external writes are allowed in these tests.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      if (response === 'admin' && url.pathname === '/api/admin/me') { await route.fulfill({ json: { admin: { email: 'audit@example.invalid' } } }); return; }
      if (response === 'stalled') { await new Promise(resolve => setTimeout(resolve, 5500)); await route.abort().catch(() => {}); return; }
      if (response === 'html') { await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>fallback</html>' }); return; }
      if (response === 'authenticated' && url.pathname === '/api/auth/me') {
        await route.fulfill({ json: { user: { wallet: '0x1111111111111111111111111111111111111111', chainType: 'evm', bdBalance: 0, level: 'Beginner', lastClaimTime: null, autoClaimActive: false, autoClaimExpiry: null, referralCode: '', referralCount: 0, completedTasks: [], lastDailyTaskDate: '' } } }); return;
      }
      if (response === 'authenticated' && url.pathname === '/api/mining/status') { await route.fulfill({ json: { canClaim: true, cooldownRemainingMs: 0, bdBalance: 0 } }); return; }
      if (response === 'authenticated' && url.pathname === '/api/leaderboard/top') { await route.fulfill({ json: { leaderboard: [] } }); return; }
      await route.fulfill({ status: 401, json: { error: 'unauthorized' } }); return;
    }
    if (url.origin === new URL(test.info().project.use.baseURL!).origin) { await route.continue(); return; }
    await route.abort();
  });
  return errors;
}
for (const response of ['unauthorized', 'stalled', 'html'] as const) {
  test('production login recovers from ' + response + ' backend', async ({ page }) => {
    const errors = await prepare(page, response);
    await page.goto('/');
    expect(errors).toEqual([]);
    await expect(page.getByRole('heading', { name: 'Sign in to Robina' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Restoring your secure session...')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
test('production game route opens 3D and preserves the classic fallback', async ({ page }) => {
  const errors = await prepare(page, 'authenticated');
  await page.goto('/gaming');
  await expect(page.getByRole('button', { name: 'ENTER 3D RAID' })).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'LOW graphics' })).toBeVisible();
  await expect(page.getByText('Development sandbox disabled.')).toHaveCount(0);
  await page.getByRole('link', { name: 'PLAY CLASSIC 2D' }).click();
  await expect(page).toHaveURL(/\/gaming\?engine=2d$/);
  await expect(page.getByRole('button', { name: 'PLAY', exact: true })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Exit to website' }).click();
  await expect(page).toHaveURL(new URL('/', test.info().project.use.baseURL!).href);
  expect(errors).toEqual([]);
});

test('production 3D and classic game links remain behind login', async ({ page }) => {
  const errors = await prepare(page, 'unauthorized');
  for (const path of ['/gaming', '/gaming?engine=2d', '/gaming?validation=1']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Sign in to Robina' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'ENTER 3D RAID' })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('built production 3D game draws, pauses and exits without changing accounts' + (process.env.PRODUCTION_TEST_WARM_ASSETS === '1' ? ' (warm-cache)' : ''), async ({ page }) => {
  const warmAssets = process.env.PRODUCTION_TEST_WARM_ASSETS === '1';
  test.setTimeout(warmAssets ? 480000 : 180000);
  await page.setViewportSize({ width: 600, height: 320 });
  const errors = await prepare(page, 'authenticated');
  const writes: string[] = [];
  const loadedModels = new Set<string>();
  page.on('requestfinished', async request => {
    if (!/\.glb(?:\.gz)?(?:\?|$)/.test(request.url())) return;
    const response = await request.response();
    if (response?.status() === 200) loadedModels.add(new URL(request.url()).pathname.replace(/\.gz$/, ''));
  });
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.url());
  });
  await page.goto('/gaming');
  await page.getByRole('button', { name: 'LOW graphics' }).click({ timeout: 30000 });
  // Optional diagnostic isolates actual renderer behavior from cold transfer.
  // It is never reported as a cold-start pass or a phone performance result.
  if (warmAssets) await expect.poll(() => loadedModels.size, { timeout: 240000 }).toBe(14);
  await page.getByRole('button', { name: 'ENTER 3D RAID' }).dispatchEvent('click');
  await page.locator('.r3-game').waitFor({ state: 'attached', timeout: 120000 });
  await expect(page.locator('.r3-game')).not.toHaveAttribute('data-status', 'loading', { timeout: 120000 });
  if (await page.locator('.r3-game').getAttribute('data-status') === 'error') {
    throw new Error('3D startup failed: ' + await page.locator('.rivals-pause-panel').innerText());
  }
  await expect(page.locator('.r3-game')).toHaveAttribute('data-status', 'playing', { timeout: 120000 });
  await expect(page.locator('[data-testid="three-host"] canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Graphics settings' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause game' }).dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'RESUME RAID' })).toBeVisible();
  await expect(page.getByLabel('3D graphics quality')).toHaveValue('low');
  await page.getByRole('button', { name: 'RETURN TO GAME MENU' }).dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'ENTER 3D RAID' })).toBeVisible();
  await expect(page.locator('[data-testid="three-host"] canvas')).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
test('production deep admin link remains gated without a session', async ({ page }) => {
  const errors = await prepare(page, 'unauthorized');
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByText('Restoring your secure session...')).toHaveCount(0);
  expect(errors).toEqual([]);
});





test('authenticated pages recover from unavailable optional services', async ({ page }) => {
  const errors = await prepare(page, 'authenticated');
  for (const [path, title] of [['/', 'BaseDrop'], ['/tasks', 'Missions'], ['/rank', 'Leaderboard'], ['/auto-claim', 'Auto Claim'], ['/marketplace', 'Marketplace'], ['/profile', 'Profile']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Restoring your secure session...')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Robina could not start' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sign in to Robina' })).toHaveCount(0);
    expect(await page.locator('#root').innerText()).not.toBe('');
    expect(errors).toEqual([]);
  }
});



test('admin pages contain service failures without crashing', async ({ page }) => {
  const errors = await prepare(page, 'admin');
  for (const path of ['/admin/users', '/admin/seasons', '/admin/tasks', '/admin/payments', '/admin/ranking', '/admin/analytics', '/admin/activity']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Admin Logout' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Restoring your secure session...')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Robina could not start' })).toHaveCount(0);
    expect(errors).toEqual([]);
  }
});
