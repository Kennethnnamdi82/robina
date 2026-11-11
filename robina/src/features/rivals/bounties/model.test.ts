import { describe, expect, it } from 'vitest';
import { DEMO_TASKS } from './demoData';
import { parseUSDC, pendingRewards, safeWebUrl, submissionError, USDC, validBaseAddress, validPostUrl } from './model';

describe('bounty input boundaries', () => {
  it('accepts only canonical HTTPS posts on the selected platform and removes tracking', () => {
    expect(validPostUrl('x', 'https://x.com/rivals/status/123456789?s=20#context')).toBe('https://x.com/rivals/status/123456789');
    expect(validPostUrl('x', 'https://twitter.com/rivals/status/123')).toBeTruthy();
    expect(validPostUrl('x', 'https://x.com/i/web/status/123')).toBeTruthy();
    expect(validPostUrl('tiktok', 'https://www.tiktok.com/@rivals.heist/video/123')).toBeTruthy();
    for (const invalid of ['javascript:alert(1)', 'http://x.com/rivals/status/123', 'https://x.com.evil.test/rivals/status/123', 'https://x.com@evil.test/rivals/status/123', 'https://user:pass@x.com/rivals/status/123', 'https://x.com:444/rivals/status/123', 'https://x.com/rivals', 'https://x.com/rivals/status/not-an-id', 'https://www.tiktok.com/@rivals/video/123']) expect(validPostUrl('x', invalid)).toBeNull();
    for (const invalid of ['https://vm.tiktok.com/short', 'https://tiktok.com/@rivals', 'https://x.com/rivals/status/123']) expect(validPostUrl('tiktok', invalid)).toBeNull();
  });
  it('validates evidence, eligibility and explicit consent without claiming to verify views', () => {
    const input = { taskId: DEMO_TASKS[0].id, postUrl: 'https://x.com/rivals/status/123', evidenceUrl: 'https://example.com/analytics.png', evidenceNotes: '', confirmed: true };
    expect(submissionError(DEMO_TASKS[0], input)).toBeNull();
    expect(submissionError(DEMO_TASKS[0], { ...input, evidenceUrl: '' })).toMatch(/evidence/);
    expect(submissionError(DEMO_TASKS[0], { ...input, confirmed: false })).toMatch(/Confirm/);
    expect(submissionError({ ...DEMO_TASKS[0], status: 'closed' }, input)).toMatch(/closed/);
    expect(submissionError(DEMO_TASKS[0], { ...input, evidenceNotes: 'x'.repeat(1501) })).toMatch(/length/);
    expect(safeWebUrl('data:text/html,hello')).toBeNull();
  });
  it('parses USDC without floating point rounding or scientific notation', () => {
    expect(parseUSDC('5')).toBe(5 * USDC); expect(parseUSDC('5.000001')).toBe(5 * USDC + 1);
    expect(parseUSDC('0.1')).toBe(100_000);
    for (const value of ['5.0000001', '1e6', '-5', 'NaN', '5,00', '', 'Infinity']) expect(parseUSDC(value)).toBeNull();
  });
  it('requires a non-zero EVM-shaped address and does not treat format as ownership proof', () => {
    expect(validBaseAddress('0x' + 'a1'.repeat(20))).toBe(true);
    for (const address of ['0x' + '0'.repeat(40), '0x123', '0x' + 'g'.repeat(40), 'seed phrase']) expect(validBaseAddress(address)).toBe(false);
  });
  it('only counts review/credit-pending rewards, not rejected or already credited records', () => {
    expect(pendingRewards(['pending_review', 'approved', 'completed', 'rejected'].map(status => ({ status, rewardMicros: 5 * USDC })) as Parameters<typeof pendingRewards>[0])).toBe(10 * USDC);
  });
});
