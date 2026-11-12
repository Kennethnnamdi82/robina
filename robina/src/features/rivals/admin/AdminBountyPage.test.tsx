import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminBounties, type AdminSubmission, type AdminWithdrawal, type BountySummary } from '@/services/bounties';
import AdminBountyPage from './AdminBountyPage';
import TaskEditor from './TaskEditor';
import { campaignTemplate } from './campaignTemplate';
import SubmissionReview from './SubmissionReview';
import WithdrawalReview from './WithdrawalReview';
import { formatUSDC, parseAmount } from './adminHelpers';
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ signOut: vi.fn().mockResolvedValue(undefined) }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const summary: BountySummary = { activeBounties: 2, totalBounties: 2, totalSubmissions: 1, pendingApprovals: 1, approvedSubmissions: 0, pendingWithdrawals: 0,
  rewardsIssuedMicros: '0', availableMicros: '0', outstandingMicros: '0', reservedMicros: '0', withdrawnMicros: '0', payoutsEnabled: false };
const submission: AdminSubmission = { _id: '123456789012345678901234', taskId: '223456789012345678901234', playerId: '323456789012345678901234',
  terms: { ...campaignTemplate('x'), rewardMode:'manual', rewardMicros:'0', revision: 1 }, postUrl: 'https://x.com/i/web/status/12345', evidenceUrl: 'https://example.com/evidence',
  evidenceNotes: '5000 claimed, not verified.', status: 'pending', riskFlags: [], createdAt: '2026-11-11T12:00:00.000Z' };
const withdrawal: AdminWithdrawal = { _id: '423456789012345678901234', playerId: submission.playerId, amountMicros: '5000000', address: '0x' + '11'.repeat(20),
  status: 'approved', createdAt: submission.createdAt, updatedAt: submission.createdAt, riskFlags: [] };
function at(path = '/admin/bounties') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><AdminBountyPage/></MemoryRouter></QueryClientProvider>);
}
describe('standalone bounty administration', () => {
  it('has its own navigation, real server totals and no dashboard link', async () => {
    vi.spyOn(adminBounties, 'summary').mockResolvedValue(summary);
    at(); await screen.findByText('ACTIVE BOUNTIES');
    expect(screen.getByRole('heading', { name: /BOUNTY COMMAND/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', {name:'Standalone bounty administration'}).querySelectorAll('a')).toHaveLength(6);
    expect(screen.queryByRole('link', {name:/dashboard/i})).not.toBeInTheDocument();
    expect(screen.getByText(/Manual payments only/)).toBeInTheDocument();
    expect(adminBounties.summary).toHaveBeenCalled();
  });
  it('shows backend failures honestly instead of demo totals', async () => {
    vi.spyOn(adminBounties, 'summary').mockRejectedValue(new Error('service_unavailable'));
    at(); await screen.findByRole('alert'); expect(screen.queryByText('ACTIVE BOUNTIES')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name:'TRY AGAIN'})).toBeEnabled();
  });
  it('creates and publishes a campaign with configurable X/TikTok form templates', async () => {
    const create = vi.spyOn(adminBounties, 'create').mockResolvedValue({} as Awaited<ReturnType<typeof adminBounties.create>>), done = vi.fn();
    render(<TaskEditor done={done} close={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', {name:'TIKTOK VIDEO TEMPLATE'}));
    expect(screen.queryByLabelText('Campaign budget (USDC)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Participation limit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reward (USDC)')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Task title'), {target:{value:'Creator Night Run'}});
    await act(async () => { fireEvent.click(screen.getByRole('button', {name:'CREATE & PUBLISH CAMPAIGN'})); });
    expect(create).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledWith(expect.objectContaining({title:'Creator Night Run',platform:'tiktok',minimumEngagement:5000,startsAt:null,expiresAt:null}));
    expect(create.mock.calls[0][0]).not.toHaveProperty('budgetMicros'); expect(create.mock.calls[0][0]).not.toHaveProperty('rewardMicros');
    expect(done).toHaveBeenCalledWith(expect.stringContaining('Campaign created and published'));
  });
  it('requires an admin-entered reward and independent checks before a once-only review request', async () => {
    const review = vi.spyOn(adminBounties, 'reviewSubmission').mockResolvedValue({...submission,status:'approved'}), done = vi.fn();
    render(<SubmissionReview row={submission} done={done} close={vi.fn()}/>);
    expect(screen.getByRole('button', {name:'ENTER REWARD TO APPROVE'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Amount to credit (USDC)'), {target:{value:'9.25'}});
    const button = screen.getByRole('button', {name:'CONFIRM & CREDIT 9.25 USDC'}); expect(button).toBeDisabled();
    expect(screen.getByText('5000 claimed, not verified.')).toBeInTheDocument();
    expect(screen.getByRole('link', {name:/Open original post/})).toHaveAttribute('rel','noopener noreferrer');
    fireEvent.change(screen.getByLabelText('Independently verified impressions / views'), {target:{value:'5000'}});
    fireEvent.change(screen.getByLabelText('Independent verification record'), {target:{value:'Independently verified ownership, live analytics and disclosure.'}});
    for (const box of screen.getAllByRole('checkbox').slice(0,4)) fireEvent.click(box);
    expect(button).toBeEnabled();
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });
    expect(review).toHaveBeenCalledOnce(); expect(review).toHaveBeenCalledWith(submission._id, expect.objectContaining({decision:'approve',rewardMicros:'9250000',observedEngagement:5000,disclosureVerified:true}));
    expect(done).toHaveBeenCalledWith(expect.stringContaining('credited exactly once'));
  });
  it('rejects with a player-visible reason and never offers a second approval on an approved record', async () => {
    const review = vi.spyOn(adminBounties,'reviewSubmission').mockResolvedValue({...submission,status:'rejected'});
    const view = render(<SubmissionReview row={submission} done={vi.fn()} close={vi.fn()}/>);
    fireEvent.click(screen.getByLabelText('Reject submission'));
    fireEvent.change(screen.getByLabelText('Player-visible rejection reason'),{target:{value:'Ownership was not independently verified.'}});
    await act(async () => { fireEvent.click(screen.getByRole('button',{name:'CONFIRM REJECTION'})); });
    expect(review).toHaveBeenCalledWith(submission._id,{decision:'reject',reason:'Ownership was not independently verified.'});
    view.unmount(); render(<SubmissionReview row={{...submission,status:'approved'}} done={vi.fn()} close={vi.fn()}/>);
    expect(screen.getByText(/already been credited/)).toBeInTheDocument(); expect(screen.queryByRole('button',{name:/CONFIRM & CREDIT/})).not.toBeInTheDocument();
  });
  it('records manual payment once after confirmation, without any signing or transfer request', async () => {
    const paid = vi.spyOn(adminBounties,'markPaid').mockResolvedValue({...withdrawal,status:'paid',paymentMethod:'manual'}), payout = vi.spyOn(adminBounties,'payout'), done = vi.fn();
    render(<WithdrawalReview row={withdrawal} enabled done={done} close={vi.fn()}/>);
    const button = screen.getByRole('button',{name:'MARK PAID & NOTIFY PLAYER'}); expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/I personally sent/));
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });
    expect(paid).toHaveBeenCalledOnce(); expect(paid).toHaveBeenCalledWith(withdrawal._id,expect.objectContaining({confirmed:true}));
    expect(payout).not.toHaveBeenCalled(); expect(done).toHaveBeenCalledWith(expect.stringContaining('No transfer was made by this app'));
  });
  it('manual payment does not depend on treasury configuration and refuses invalid transaction hashes', () => {
    render(<WithdrawalReview row={withdrawal} enabled={false} done={vi.fn()} close={vi.fn()}/>);
    fireEvent.click(screen.getByLabelText(/I personally sent/));
    expect(screen.getByRole('button',{name:'MARK PAID & NOTIFY PLAYER'})).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Base transaction hash (recommended)'),{target:{value:'not-a-hash'}});
    expect(screen.getByRole('button',{name:'MARK PAID & NOTIFY PLAYER'})).toBeDisabled();
    expect(screen.queryByRole('button',{name:/SEND.*ON BASE/})).not.toBeInTheDocument();
  });
  it('does not offer a second manual payment for paid or previously signed records', () => {
    const view=render(<WithdrawalReview row={{...withdrawal,status:'paid',paymentMethod:'manual'}} done={vi.fn()} close={vi.fn()}/>);
    expect(screen.queryByRole('button',{name:'MARK PAID & NOTIFY PLAYER'})).not.toBeInTheDocument(); view.unmount();
    render(<WithdrawalReview row={{...withdrawal,status:'broadcast'}} done={vi.fn()} close={vi.fn()}/>);
    expect(screen.getByText(/Existing signed payment: do not pay it manually/)).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'MARK PAID & NOTIFY PLAYER'})).not.toBeInTheDocument();
  });
  it('formats maximum USDC micro-units without floating-point truncation', () => {
    expect(formatUSDC('8999999999999999')).toBe('8,999,999,999.999999'); expect(parseAmount('5.000001')).toBe('5000001');
    for(const value of ['1e6','-5','5.0000001','0'])expect(parseAmount(value)).toBeNull();
  });
});
