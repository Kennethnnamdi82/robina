import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page, response: 'unauthorized' | 'stalled' | 'html' | 'authenticated' | 'admin') {
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
    if (url.origin === 'http://127.0.0.1:8082') { await route.continue(); return; }
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
test('production game route loads, renders and returns to base', async ({ page }) => {
  const errors = await prepare(page, 'authenticated');
  await page.goto('/gaming');
  await expect(page.getByRole('button', { name: 'ENTER OPERATION' })).toBeEnabled({ timeout: 20000 });
  await expect(page.locator('canvas[aria-label="RUGFIRE third-person combat world"]')).toBeVisible();
  await page.getByRole('button', { name: 'ENTER OPERATION' }).click();
  await expect(page.locator('.rf-reticle')).toBeVisible();
  await page.evaluate(() => document.exitPointerLock());
  await page.getByRole('button', { name: 'RETURN TO BASE' }).click();
  await expect(page.locator('.rf-game')).toHaveCount(0);
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
