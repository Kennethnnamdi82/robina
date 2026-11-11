import { test, expect, type Page } from '@playwright/test';

async function fixture(page: Page) {
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method() + ' ' + url.pathname);
      if (url.pathname === '/api/auth/me') await route.fulfill({ json: { user: { wallet: '0x1111111111111111111111111111111111111111', chainType: 'evm', bdBalance: 0, level: 'Beginner', lastClaimTime: null, autoClaimActive: false, autoClaimExpiry: null, referralCode: '', referralCount: 0, completedTasks: [], lastDailyTaskDate: '' } } });
      else await route.fulfill({ status: 401, json: { error: 'unauthorized' } });
      return;
    }
    if (url.origin === new URL(test.info().project.use.baseURL!).origin) await route.continue();
    else await route.abort();
  });
  return { errors, writes };
}
async function fits(page: Page) {
  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth,
    overflow: [...document.querySelectorAll('body *')].map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })).filter(element => element.right > innerWidth + 1 && element.width > 0).slice(0, 14),
  }));
  expect(layout.width, JSON.stringify(layout.overflow)).toBeLessThanOrEqual(layout.viewport + 1);
}

test('bounty navigation and layouts fit desktop, small phones and Android-style landscape', async ({ page }, info) => {
  test.setTimeout(180000); const audit = await fixture(page); await page.goto('/');
  await expect(page.getByRole('link', { name: 'BOUNTY & EARN', exact: true })).toBeVisible();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport); await page.evaluate(() => document.fonts.ready);
    const menu = await page.locator('.rh-command-nav').boundingBox(), dock = await page.locator('.rh-lobby-deploy').boundingBox();
    expect(menu!.y + menu!.height).toBeLessThanOrEqual(dock!.y);
  }
  await page.getByRole('link', { name: 'BOUNTY & EARN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'BOUNTY & EARN', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'X bounty', exact: true })).toBeVisible();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport); await page.evaluate(() => document.fonts.ready); await fits(page);
    await page.screenshot({ path: info.outputPath(`bounties-${viewport.width}.png`), fullPage: true });
    const trigger = page.getByRole('article', { name: 'TikTok bounty', exact: true }).getByRole('button');
    await trigger.click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox(); expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: info.outputPath(`bounty-dialog-${viewport.width}.png`) });
    // Capacitor's Android back handler dispatches this same Escape event.
    await dialog.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); await fits(page);
    await expect(page.getByRole('button', { name: 'REQUEST WITHDRAWAL', exact: true })).toBeDisabled();
  }
  await page.getByRole('link', { name: 'BACK TO LOBBY' }).click(); await expect(page.getByRole('link', { name: 'PLAY', exact: true })).toBeVisible();
  expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([]);
});

test('phone creator submission validates, persists Pending Review and blocks repeats without payments', async ({ page }, info) => {
  test.setTimeout(180000); const audit = await fixture(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/bounties');
  const x = page.getByRole('article', { name: 'X bounty', exact: true }); await x.getByRole('button').click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('PROMOTIONAL DISCLOSURE REQUIRED');
  await dialog.getByLabel('X post URL', { exact: true }).fill('https://x.com.evil.test/rivals/status/123');
  await dialog.getByRole('button', { name: 'CONFIRM SUBMISSION' }).click(); await expect(dialog.getByRole('alert')).toContainText('HTTPS X');
  await dialog.getByLabel('X post URL', { exact: true }).fill('https://x.com/rivals/status/123456789?s=20');
  await dialog.getByLabel('Engagement evidence link (required)', { exact: true }).fill('https://example.com/analytics.png');
  await dialog.getByLabel('Supporting notes (optional)', { exact: true }).fill('5,200 genuine impressions. Demo evidence only.');
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'CONFIRM SUBMISSION' }).click();
  await expect(dialog).toHaveCount(0); await expect(x.getByRole('button')).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Submission received' })).toContainText('Pending Review');
  await expect(page.getByRole('link', { name: /View submission/ })).toHaveAttribute('href', 'https://x.com/rivals/status/123456789');
  await page.reload(); await expect(x.getByRole('button')).toBeDisabled(); await expect(page.getByText('Awaiting review.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Completed', exact: true }).click(); await expect(page.getByText('NO MATCHING SUBMISSIONS')).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'MARK ALL READ' }).click(); await expect(page.getByRole('button', { name: 'MARK ALL READ' })).toBeDisabled();
  await page.getByLabel('Base wallet address', { exact: true }).fill('0x123'); await page.getByRole('button', { name: 'SAVE DEMO ADDRESS' }).click(); await expect(page.getByRole('alert')).toContainText('40 hexadecimal');
  await page.getByLabel('Base wallet address', { exact: true }).fill('0x' + '1'.repeat(40)); await page.getByRole('button', { name: 'SAVE DEMO ADDRESS' }).click();
  await expect(page.getByText('Demo destination saved on this device.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'REQUEST WITHDRAWAL' })).toBeDisabled();
  await fits(page); await page.screenshot({ path: info.outputPath('bounty-submitted-phone.png'), fullPage: true });
  expect(audit.errors).toEqual([]); expect(audit.writes).toEqual([]);
});
