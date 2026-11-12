import { test, expect, type Page } from '@playwright/test';
const backend = 'http://127.0.0.1:4012';
async function owner(page: Page) {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' }); await page.getByLabel('Email', { exact: true }).fill('bounty-qa@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Bounty-QA-Only-Password!'); await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/bounties$/); await expect(page.getByRole('heading', { name: /BOUNTY COMMAND/ })).toBeVisible();
}
async function fits(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual((await page.viewportSize())!.width + 1); }
test.beforeEach(async ({ request }) => { expect((await request.post(backend + '/__qa/reset', { data: {} })).ok()).toBe(true); });
test('real UI + Express + Mongo: publish for all → submit → admin-entered reward → external payment marked paid → player notified', async ({ page, browser }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await owner(page); await expect(page.getByRole('link', { name: /dashboard/i })).toHaveCount(0);
  await page.getByRole('link', { name: 'CAMPAIGNS', exact: true }).click(); await page.getByRole('button', { name: 'NEW CAMPAIGN' }).click();
  await page.getByRole('dialog').getByLabel('Task title').fill('Midnight Creator Contract'); await page.getByRole('button', { name: 'CREATE DRAFT' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); const campaign = page.getByRole('row').filter({ hasText: 'Midnight Creator Contract' });
  await campaign.getByRole('button', { name: 'PUBLISH', exact: true }).click(); await page.getByRole('dialog').getByRole('checkbox').check(); await page.getByRole('button', { name: 'CONFIRM PUBLISH' }).click();
  await expect(campaign).toContainText('Published');
  const playerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:8086', viewport: { width: 390, height: 844 } });
  try {
    await playerContext.request.post(backend + '/__qa/player-session'); const player = await playerContext.newPage(); player.on('pageerror', error => errors.push(error.message));
    await player.goto('/bounties', { waitUntil: 'domcontentloaded' }); const task = player.getByRole('article', { name: 'X bounty', exact: true }); await task.getByRole('button').click();
    const form = player.getByRole('dialog'); await form.getByLabel('X post URL').fill('https://x.com/rivals/status/123456789');
    await form.getByLabel('Engagement evidence link (required)').fill('https://evidence.example.com/analytics'); await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'CONFIRM SUBMISSION' }).click(); await expect(form).toHaveCount(0);
    await expect(player.getByText('Awaiting manual review.', { exact: false })).toBeVisible();
    await page.getByRole('link', { name: /SUBMISSION REVIEWS/ }).click(); await page.getByRole('button', { name: 'REVIEW SUBMISSION' }).click();
    const review = page.getByRole('dialog'); await expect(review.getByRole('button', { name: 'ENTER REWARD TO APPROVE' })).toBeDisabled();
    await review.getByLabel('Amount to credit (USDC)').fill('10');
    const confirm = review.getByRole('button', { name: 'CONFIRM & CREDIT 10.00 USDC' }); await expect(confirm).toBeDisabled();
    await review.getByLabel('Independently verified impressions / views').fill('5000');
    await review.getByLabel('Independent verification record').fill('Simulated integration test: ownership, genuine engagement and disclosure checks independently recorded.');
    for (const box of await review.getByRole('checkbox').all()) await box.check(); await confirm.click();
    await expect(review).toHaveCount(0); await expect(page.getByRole('status').filter({ hasText: 'credited exactly once' })).toBeVisible();
    await player.reload(); await expect(player.getByText('Reward credited. This contract is complete', { exact: false })).toBeVisible();
    await player.getByRole('link', { name: 'CONTRACTS', exact: true }).click(); await expect(task.getByRole('button')).toBeDisabled();
    await player.getByRole('link', { name: 'WALLET', exact: true }).click(); await expect(player.locator('.rb-balance')).toContainText('10.00');
    await player.getByRole('button', { name: 'REQUEST WITHDRAWAL' }).click(); const withdrawal = player.getByRole('dialog');
    await withdrawal.getByLabel('Amount (USDC)').fill('5'); await withdrawal.getByLabel('Destination on Base').fill('0x' + '33'.repeat(20));
    await withdrawal.getByRole('checkbox').check(); await withdrawal.getByRole('button', { name: 'CONFIRM WITHDRAWAL REQUEST' }).click();
    await expect(withdrawal).toHaveCount(0); await expect(player.getByText('Awaiting manual payment', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'WITHDRAWALS', exact: true }).click(); await page.getByRole('button', { name: 'VIEW / MANAGE' }).click();
    const transfer = page.getByRole('dialog'); await expect(transfer).toContainText('0x' + '33'.repeat(20));
    await expect(transfer.getByRole('button', { name: 'MARK PAID & NOTIFY PLAYER' })).toBeDisabled();
    await transfer.getByLabel('Base transaction hash (recommended)').fill('0x' + 'ab'.repeat(32));
    await transfer.getByLabel(/I personally sent/).check(); await transfer.getByRole('button', { name: 'MARK PAID & NOTIFY PLAYER' }).click();
    await expect(transfer).toHaveCount(0); await expect(page.getByRole('status').filter({ hasText: 'Withdrawal marked paid' })).toBeVisible();
    await player.reload(); await expect(player.getByText('Paid / administrator confirmed', { exact: true })).toBeVisible(); await expect(player.getByRole('link', { name: /View transaction/ })).toHaveAttribute('href', /https:\/\/basescan.org\/tx\/0x/);
    await player.getByRole('link', { name: /NOTIFICATIONS/ }).click(); await expect(player.getByText(/Open your Base wallet to confirm receipt/)).toBeVisible();
    await fits(player); await player.screenshot({ path: info.outputPath('player-verified-payout-phone.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await playerContext.close(); }
});
test('standalone admin navigation, table scrolling and focused dialogs fit desktop, phone and landscape', async ({ page, request }, info) => {
  await request.post(backend + '/__qa/reset', { data: { seed: true } }); await owner(page);
  for (const size of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size); await fits(page); await page.screenshot({ path: info.outputPath(`admin-overview-${size.width}.png`), fullPage: true });
    for (const label of ['CAMPAIGNS', 'SUBMISSION REVIEWS', 'PLAYER EARNINGS', 'WITHDRAWALS', 'AUDIT LOG']) {
      await page.getByRole('navigation').getByRole('link', { name: new RegExp('^' + label) }).click(); await expect(page.locator('.ab-state').filter({ hasText: 'Connecting' })).toHaveCount(0); await fits(page);
      if (label === 'CAMPAIGNS') {
        const trigger = page.getByRole('button', { name: 'NEW CAMPAIGN' }); await trigger.click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
        const rect = await dialog.boundingBox(); expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height + 1);
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); await page.screenshot({ path: info.outputPath(`admin-editor-${size.width}.png`) });
        await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      }
    }
    await page.getByRole('link', { name: 'OVERVIEW', exact: true }).click();
  }
});
