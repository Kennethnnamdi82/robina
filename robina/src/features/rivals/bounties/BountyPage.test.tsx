import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BountyPage from './BountyPage';
import { createDemoGateway, demoStorageKey } from './demoGateway';
import { emptyDemoState } from './demoData';
import { USDC, type BountyGateway, type BountySnapshot, type NotificationKind, type SubmissionStatus } from './model';

function at(gateway?: BountyGateway, identity = 'ui-player',path='/bounties') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/bounties/*" element={<BountyPage identity={identity} gateway={gateway ?? createDemoGateway(identity)}/>}/></Routes></MemoryRouter>);
}
async function board() { await screen.findAllByRole('button', { name: 'VIEW TASK / SUBMIT' }); }
async function openX() {
  const task = screen.getByRole('article', { name: 'X bounty' });
  const trigger = within(task).getByRole('button', { name: 'VIEW TASK / SUBMIT' });
  trigger.focus(); fireEvent.click(trigger); return screen.findByRole('dialog');
}
function fillX(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText('X post URL'), { target: { value: 'https://x.com/rivals/status/123456789?s=20' } });
  fireEvent.change(within(dialog).getByLabelText('Engagement evidence link (required)'), { target: { value: 'https://example.com/analytics.png' } });
  fireEvent.click(within(dialog).getByRole('checkbox'));
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Bounty & Earn frontend', () => {
  it('shows honest demo tasks, a zero-balance wallet, empty history and notifications', async () => {
    const network = vi.spyOn(globalThis, 'fetch'); at(); await board();
    expect(screen.getByRole('heading', { name: 'BOUNTY & EARN' })).toBeInTheDocument();
    expect(screen.getByText('PHASE 1 / INTERACTIVE DEMO')).toBeInTheDocument();
    expect(screen.getByText('5,000 genuine impressions')).toBeInTheDocument(); expect(screen.getByText('5,000 genuine views')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'REQUEST WITHDRAWAL' })).not.toBeInTheDocument();
    expect(screen.queryByText('YOUR NEXT MOVE STARTS HERE')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('link',{name:'MY BOUNTIES'}));expect(screen.getByText('YOUR NEXT MOVE STARTS HERE')).toBeInTheDocument();fireEvent.click(screen.getByRole('link',{name:'WALLET'}));expect(screen.getByRole('button', { name: 'REQUEST WITHDRAWAL' })).toBeDisabled(); expect(screen.getByText(/No withdrawals yet/)).toBeInTheDocument();
    expect(network).not.toHaveBeenCalled();
  });
  it('validates URLs and evidence, records Pending Review, restores focus, persists and blocks repeats', async () => {
    const view = at(); await board(); const dialog = await openX();
    expect(within(dialog).getByText('PROMOTIONAL DISCLOSURE REQUIRED')).toBeInTheDocument();
    const submit = within(dialog).getByRole('button', { name: 'CONFIRM SUBMISSION' });
    fireEvent.change(within(dialog).getByLabelText('X post URL'), { target: { value: 'https://x.com.evil.test/post' } });
    fireEvent.click(submit); expect(await screen.findByRole('alert')).toHaveTextContent('HTTPS X');
    fillX(dialog); fireEvent.change(within(dialog).getByLabelText('Engagement evidence link (required)'), { target: { value: '' } });
    fireEvent.click(submit); expect(screen.getByRole('alert')).toHaveTextContent('evidence');
    fireEvent.change(within(dialog).getByLabelText('Engagement evidence link (required)'), { target: { value: 'https://example.com/analytics.png' } });
    await act(async()=>{fireEvent.click(submit);});
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(/Submission received — Pending Review/)).toBeInTheDocument();
    await screen.findByRole('link', { name: /View submission/ },{timeout:5000});expect(screen.queryByRole('article', { name: 'X bounty' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View submission/ })).toHaveAttribute('href', 'https://x.com/rivals/status/123456789');
    expect(screen.queryByRole('button', { name: 'REQUEST WITHDRAWAL' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:'CONTRACTS'}));view.unmount(); at(); await board();
    expect(within(screen.getByRole('article', { name: 'X bounty' })).getByRole('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('link',{name:'MY BOUNTIES'}));expect(screen.getAllByText('Pending Review').length).toBeGreaterThan(0);
  });
  it('submits TikTok separately and keeps the other account private', async () => {
    const view = at(); await board();
    fireEvent.click(within(screen.getByRole('article', { name: 'TikTok bounty' })).getByRole('button'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('TikTok video URL'), { target: { value: 'https://www.tiktok.com/@rivals/video/123456789' } });
    fireEvent.change(within(dialog).getByLabelText('Engagement evidence link (required)'), { target: { value: 'https://example.com/video-analytics.png' } });
    fireEvent.click(within(dialog).getByRole('checkbox')); fireEvent.click(within(dialog).getByRole('button', { name: 'CONFIRM SUBMISSION' }));
    await screen.findByText(/Awaiting review/); view.unmount(); at(undefined, 'another-player'); await board();
    fireEvent.click(screen.getByRole('link',{name:'MY BOUNTIES'}));expect(screen.getByText('YOUR NEXT MOVE STARTS HERE')).toBeInTheDocument(); expect(screen.queryByRole('link', { name: /View submission/ })).not.toBeInTheDocument();
  });
  it('supports all review states, reasons, archived completed tasks and all six notification kinds', async () => {
    const api = createDemoGateway('review-fixture'), data = await api.load();
    data.submissions = (['completed', 'rejected', 'approved', 'pending_review'] as SubmissionStatus[]).map((status, index) => ({
      id: String(index), taskId: index < 2 ? data.tasks[index].id : 'archived-' + index, taskTitle: 'CONTRACT ' + index,
      platform: 'x', status, rewardMicros: 5 * USDC, submittedAt: '2026-11-11T12:00:00.000Z',
      postUrl: `https://x.com/rivals/status/${index + 100}`, evidenceUrl: '', evidenceNotes: '', rejectionReason: status === 'rejected' ? 'Disclosure was missing.' : undefined,
    }));
    data.notifications = (['published', 'received', 'approved', 'rejected', 'credited', 'withdrawal'] as NotificationKind[]).map(kind => ({ id: kind, kind, title: `Event: ${kind}`, message: `Demo ${kind}`, createdAt: '2026-11-11T12:00:00.000Z', read: false }));
    at({ ...api, load: vi.fn().mockResolvedValue(data), markNotificationsRead: vi.fn().mockResolvedValue({ ...data, notifications: data.notifications.map(n => ({ ...n, read: true })) }) });
    await screen.findByRole('article',{name:'X bounty'});fireEvent.click(screen.getByRole('link',{name:'MY BOUNTIES'}));await screen.findByText('CONTRACT 0'); expect(screen.getByText(/Disclosure was missing/)).toBeInTheDocument();
    expect(screen.getByText(/Reward credited. This contract is complete/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:'CONTRACTS'}));expect(within(screen.getByRole('article', { name: 'X bounty' })).getByRole('button')).toBeDisabled();fireEvent.click(screen.getByRole('link',{name:/NOTIFICATIONS/}));
    for (const kind of ['published', 'received', 'approved', 'rejected', 'credited', 'withdrawal']) expect(screen.getByText(`Event: ${kind}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:'MY BOUNTIES'}));fireEvent.click(screen.getByRole('button', { name: 'Completed' })); expect(screen.getByText('CONTRACT 0')).toBeInTheDocument(); expect(screen.queryByText('CONTRACT 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:/NOTIFICATIONS/}));fireEvent.click(screen.getByRole('button', { name: 'MARK ALL READ' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'MARK ALL READ' })).toBeDisabled());
  });
  it('handles loading, empty boards and histories without fake account activity', async () => {
    const api = createDemoGateway('empty'); const data = await api.load();
    let resolve: (data: BountySnapshot) => void;
    const pending = new Promise<BountySnapshot>(done => { resolve = done; });
    at({ ...api, load: () => pending });
    expect(screen.getByRole('status', { name: 'Loading bounty board' })).toBeInTheDocument();
    await act(async () => { resolve({ ...data, tasks: [], notifications: [] }); });
    expect(screen.getByText('NO BOUNTIES YET')).toBeInTheDocument(); fireEvent.click(screen.getByRole('link',{name:/NOTIFICATIONS/}));expect(screen.getByText('ALL QUIET FOR NOW')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:'WALLET'})); expect(screen.getAllByText('0.00').length).toBeGreaterThan(0);
  });
  it('recovers a failed load through retry and reports an adapter submission error', async () => {
    const api = createDemoGateway('failure'); const data = await api.load();
    at({ ...api, load: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(data), submit: vi.fn().mockRejectedValue(new Error('Submission not saved. Retry.')) });
    await screen.findByText('BOUNTY SERVICE UNAVAILABLE'); fireEvent.click(screen.getByRole('button', { name: 'TRY AGAIN' })); await board();
    const dialog = await openX(); fillX(dialog); fireEvent.click(within(dialog).getByRole('button', { name: 'CONFIRM SUBMISSION' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Submission not saved');
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.queryByText('YOUR NEXT MOVE STARTS HERE')).not.toBeInTheDocument();
  });
  it('validates and saves the Base destination without connecting or signing', async () => {
    at(); await board();fireEvent.click(screen.getByRole('link',{name:'WALLET'})); fireEvent.change(screen.getByLabelText('Base wallet address'), { target: { value: '0x123' } }); fireEvent.click(screen.getByRole('button', { name: 'SAVE DEMO ADDRESS' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('40 hexadecimal');
    fireEvent.change(screen.getByLabelText('Base wallet address'), { target: { value: '0x' + '1'.repeat(40) } }); fireEvent.click(screen.getByRole('button', { name: 'SAVE DEMO ADDRESS' }));
    expect(await screen.findByText('Demo destination saved on this device.')).toBeInTheDocument();
  });
  it('validates the 5 USDC minimum and confirms only a simulated withdrawal with funded fixture data', async () => {
    const seed = emptyDemoState(); seed.wallet.availableMicros = 10 * USDC; seed.wallet.earnedMicros = 10 * USDC; seed.wallet.address = '0x' + '1'.repeat(40);
    localStorage.setItem(demoStorageKey('funded-ui'), JSON.stringify(seed)); at(undefined, 'funded-ui'); await board();fireEvent.click(screen.getByRole('link',{name:'WALLET'}));
    fireEvent.click(screen.getByRole('button', { name: 'REQUEST WITHDRAWAL' })); const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Amount (USDC)'), { target: { value: '4' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'CONFIRM DEMO REQUEST' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 5');
    fireEvent.change(within(dialog).getByLabelText('Amount (USDC)'), { target: { value: '11' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'CONFIRM DEMO REQUEST' }));
    expect(screen.getByRole('alert')).toHaveTextContent('exceeds');
    fireEvent.change(within(dialog).getByLabelText('Amount (USDC)'), { target: { value: '5' } }); fireEvent.click(within(dialog).getByRole('checkbox')); fireEvent.click(within(dialog).getByRole('button', { name: 'CONFIRM DEMO REQUEST' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Requested')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'REQUEST WITHDRAWAL' })).toBeDisabled();
    expect(screen.getByText('Demo withdrawal requested. No USDC has been sent.')).toBeInTheDocument();
  });
  it('prevents double submission while a request is pending and cancels loading on unmount', async () => {
    const api = createDemoGateway('slow'), data = await api.load();
    let resolve: (value: BountySnapshot) => void;
    const submit = vi.fn(() => new Promise<BountySnapshot>(done => { resolve = done; }));
    const load = vi.fn().mockResolvedValue(data);
    const view = at({ ...api, load, submit }); await board(); const dialog = await openX(); fillX(dialog);
    const confirm = within(dialog).getByRole('button', { name: 'CONFIRM SUBMISSION' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1); expect(within(dialog).getByRole('button', { name: 'SUBMITTING…' })).toBeDisabled();
    await act(async () => { resolve(await api.submit({ taskId: data.tasks[0].id, postUrl: 'https://x.com/rivals/status/123', evidenceUrl: 'https://example.com/evidence', evidenceNotes: '', confirmed: true })); });
    view.unmount(); expect((load.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
  });
});
