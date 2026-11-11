import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoGateway, demoStorageKey } from './demoGateway';
import { DEMO_TASKS, emptyDemoState } from './demoData';
import { USDC, type SubmissionStatus } from './model';

const input = { taskId: DEMO_TASKS[0].id, postUrl: 'https://x.com/rivals/status/123?s=20', evidenceUrl: 'https://example.com/evidence.png', evidenceNotes: '5,200 impressions', confirmed: true };
const address = '0x' + '1'.repeat(40);
beforeEach(() => localStorage.clear());
describe('isolated frontend-only bounty gateway', () => {
  it('persists a pending record and notification without crediting rewards or using the network', async () => {
    const network = vi.spyOn(globalThis, 'fetch');
    const gateway = createDemoGateway('player-one');
    expect((await gateway.load()).wallet.availableMicros).toBe(0);
    const result = await gateway.submit(input);
    expect(result.submissions[0]).toMatchObject({ status: 'pending_review', rewardMicros: 10 * USDC, postUrl: 'https://x.com/rivals/status/123' });
    expect(result.wallet).toMatchObject({ availableMicros: 0, earnedMicros: 0, withdrawnMicros: 0 });
    expect(result.notifications[0].kind).toBe('received');
    expect((await createDemoGateway('player-one').load()).submissions).toEqual(result.submissions);
    expect((await createDemoGateway('player-two').load()).submissions).toEqual([]);
    expect(network).not.toHaveBeenCalled(); network.mockRestore();
  });
  it.each<SubmissionStatus>(['pending_review', 'approved', 'rejected', 'completed'])('never repeats a %s task, even after reload', async status => {
    const data = await createDemoGateway('player').submit(input);
    data.submissions[0].status = status;
    localStorage.setItem(demoStorageKey('player'), JSON.stringify(data));
    await expect(createDemoGateway('player').submit(input)).rejects.toThrow(/already submitted/);
  });
  it('rejects double-click submissions at the adapter boundary', async () => {
    const gateway = createDemoGateway('player');
    const result = await Promise.allSettled([gateway.submit(input), gateway.submit(input)]);
    expect(result.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    expect((await gateway.load()).submissions).toHaveLength(1);
  });
  it('validates inputs again and never accepts unknown tasks', async () => {
    const gateway = createDemoGateway('player');
    await expect(gateway.submit({ ...input, confirmed: false })).rejects.toThrow(/Confirm/);
    await expect(gateway.submit({ ...input, taskId: 'made-up' })).rejects.toThrow(/no longer/);
    expect((await gateway.load()).submissions).toHaveLength(0);
  });
  it('saves a destination, rejects insufficient funds, and marks notifications read', async () => {
    const gateway = createDemoGateway('player');
    expect((await gateway.saveAddress(address)).wallet.address).toBe(address);
    await expect(gateway.saveAddress('0x000')).rejects.toThrow(/address/);
    await expect(gateway.requestWithdrawal({ address, amountMicros: 5 * USDC, confirmed: true })).rejects.toThrow(/insufficient/);
    expect((await gateway.markNotificationsRead()).notifications.every(n => n.read)).toBe(true);
  });
  it('simulates a funded request only in an explicit test fixture, reserving rather than paying funds', async () => {
    const seed = emptyDemoState(); seed.wallet.availableMicros = 12 * USDC; seed.wallet.earnedMicros = 12 * USDC;
    localStorage.setItem(demoStorageKey('funded-fixture'), JSON.stringify(seed));
    const gateway = createDemoGateway('funded-fixture');
    for (const amountMicros of [USDC, 13 * USDC, NaN, 5 * USDC + .1]) await expect(gateway.requestWithdrawal({ address, amountMicros, confirmed: true })).rejects.toThrow();
    await expect(gateway.requestWithdrawal({ address, amountMicros: 5 * USDC, confirmed: false })).rejects.toThrow(/Confirm/);
    const data = await gateway.requestWithdrawal({ address, amountMicros: 5 * USDC, confirmed: true });
    expect(data.wallet).toMatchObject({ availableMicros: 7 * USDC, withdrawnMicros: 0 });
    expect(data.withdrawals[0]).toMatchObject({ status: 'requested', amountMicros: 5 * USDC, address });
    expect(data.notifications[0].kind).toBe('withdrawal');
    await expect(gateway.requestWithdrawal({ address, amountMicros: 5 * USDC, confirmed: true })).rejects.toThrow(/already pending/);
  });
  it('continues honestly in session-only mode when storage is blocked, full or corrupted', async () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: vi.fn() };
    const gateway = createDemoGateway('private', blocked);
    expect((await gateway.load()).persistence).toBe('session');
    expect((await gateway.submit(input)).submissions).toHaveLength(1);
    await expect(gateway.submit(input)).rejects.toThrow(/already submitted/);
    const full = createDemoGateway('full', { getItem: () => null, setItem: () => { throw new Error('quota'); } });
    expect((await full.submit(input)).persistence).toBe('session');
    localStorage.setItem(demoStorageKey('corrupt'), '{"submissions":42}');
    expect((await createDemoGateway('corrupt').load()).persistence).toBe('session');
  });
  it('returns detached snapshots and honours cancelled loads', async () => {
    const gateway = createDemoGateway('player'), data = await gateway.load(); data.tasks[0].title = 'mutated';
    expect((await gateway.load()).tasks[0].title).toBe('MAKE THE CITY TALK');
    const controller = new AbortController(); controller.abort();
    await expect(gateway.load(controller.signal)).rejects.toThrow();
  });
});
