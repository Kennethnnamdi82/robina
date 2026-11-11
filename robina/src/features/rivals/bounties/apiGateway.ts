import { playerBounties, bountyError, type BountyTask as ServerTask, type BountySubmission as ServerSubmission, type BountyWithdrawal as ServerWithdrawal, type BountyNotification as ServerNotice, type LedgerEntry, type Page } from '@/services/bounties';
import type { BountyGateway, BountySnapshot, BountyTask, BountySubmission, BountyWithdrawal, BountyNotification } from './model';

export function exactClientMicros(value: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error('invalid_money_response');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > 9_000_000_000_000_000) throw new Error('invalid_money_response');
  return number; // Exact bounded integers only. Never used to award a reward or calculate server balances.
}
const titles = { published: 'New bounty published', received: 'Submission received', approved: 'Submission approved', rejected: 'Submission rejected', credited: 'Reward credited', withdrawal: 'Withdrawal status updated' };
const task = (row: ServerTask): BountyTask => ({ id: row._id, ...row.terms, rewardMicros: exactClientMicros(row.terms.rewardMicros),
  requirement: `${row.terms.minimumEngagement.toLocaleString()} genuine ${row.terms.platform === 'x' ? 'impressions' : 'views'}`,
  status: row.status === 'active' && row.participants < row.participationLimit && BigInt(row.budgetMicros) - BigInt(row.committedMicros) >= BigInt(row.terms.rewardMicros) ? 'active' : 'closed',
  startsAt: row.startsAt, expiresAt: row.expiresAt, submitted: Boolean(row.participation),
  submissionStatus: row.participation ? row.participation.status === 'approved' ? 'completed' : row.participation.status === 'pending' ? 'pending_review' : 'rejected' : undefined });
const submission = (row: ServerSubmission): BountySubmission => ({ id: row._id, taskId: row.taskId, taskTitle: row.terms.title, platform: row.terms.platform,
  postUrl: row.postUrl, evidenceUrl: row.evidenceUrl || '', evidenceNotes: row.evidenceNotes || '', rewardMicros: exactClientMicros(row.terms.rewardMicros),
  status: row.status === 'approved' ? 'completed' : row.status === 'pending' ? 'pending_review' : 'rejected', submittedAt: row.createdAt, rejectionReason: row.review?.reason });
const withdrawal = (row: ServerWithdrawal): BountyWithdrawal => ({ id: row._id, address: row.address, amountMicros: exactClientMicros(row.amountMicros), requestedAt: row.createdAt,
  status: row.status, reason: row.review?.reason || row.failureReason,
  transactionUrl: /^0x[a-f\d]{64}$/i.test(row.txHash || '') ? `https://basescan.org/tx/${row.txHash}` : undefined });
const notification = (row: ServerNotice): BountyNotification => ({ id: row._id, kind: row.kind, title: titles[row.kind], message: row.message, createdAt: row.createdAt, read: row.read });
type History = 'submissions' | 'withdrawals' | 'notifications' | 'ledger';

/** Real cookie-authenticated transport. No demo fallback or migration of local balances. */
export function createApiGateway(identity: string): BountyGateway {
  let cached: BountySnapshot | undefined;
  const pageCounts: Record<History, number> = { submissions: 1, withdrawals: 1, notifications: 1, ledger: 1 };
  let pendingWithdrawal: { fingerprint: string; key: string } | undefined;
  const retryStorage = `rivals_bounty_withdrawal_retry:${encodeURIComponent(identity)}`;
  // Only an opaque retry key + payload fingerprint, not balances, tokens or treasury data.
  try { const saved = sessionStorage.getItem(retryStorage); if (saved) { const parsed = JSON.parse(saved); if (typeof parsed.fingerprint === 'string' && /^[a-zA-Z0-9_-]{16,100}$/.test(parsed.key)) pendingWithdrawal = parsed; } } catch { /* Retry is still stable in memory. */ }
  async function pages<T>(kind: string, count: number, signal?: AbortSignal): Promise<Page<T>> {
    let before: string | undefined; const items: T[] = [];
    for (let i = 0; i < count; i++) {
      const page = await playerBounties.list<T>(kind, before, signal);
      items.push(...page.items); before = page.nextBefore || undefined;
      if (!before) break;
    }
    return { items, nextBefore: before || null };
  }
  async function load(signal?: AbortSignal): Promise<BountySnapshot> {
    // Tasks are usually a small list. Load all published campaigns, never fabricated examples.
    const tasks: ServerTask[] = []; let before: string | undefined;
    do { const page = await playerBounties.list<ServerTask>('tasks', before, signal); tasks.push(...page.items); before = page.nextBefore || undefined; } while (before);
    const [wallet, subs, withdrawals, notices, ledger] = await Promise.all([
      playerBounties.wallet(signal), pages<ServerSubmission>('submissions', pageCounts.submissions, signal),
      pages<ServerWithdrawal>('withdrawals', pageCounts.withdrawals, signal), pages<ServerNotice>('notifications', pageCounts.notifications, signal),
      pages<LedgerEntry>('ledger', pageCounts.ledger, signal),
    ]);
    cached = { version: 1, mode: 'live', persistence: 'server', tasks: tasks.map(task), submissions: subs.items.map(submission),
      withdrawals: withdrawals.items.map(withdrawal), notifications: notices.items.map(notification), ledger: ledger.items,
      wallet: { address: wallet.address, availableMicros: exactClientMicros(wallet.availableMicros), earnedMicros: exactClientMicros(wallet.earnedMicros), withdrawnMicros: exactClientMicros(wallet.withdrawnMicros),
        pendingMicros: exactClientMicros(wallet.pendingMicros), reservedMicros: exactClientMicros(wallet.reservedMicros) }, payoutsEnabled: wallet.payoutsEnabled,
      more: { submissions: Boolean(subs.nextBefore), withdrawals: Boolean(withdrawals.nextBefore), notifications: Boolean(notices.nextBefore), ledger: Boolean(ledger.nextBefore) } };
    return cached;
  }
  async function mutate(action: () => Promise<unknown>, kind: 'submit' | 'withdrawal' | 'other' = 'other'): Promise<BountySnapshot> {
    try { await action(); }
    catch (error) { throw new Error(bountyError(error)); }
    try { return await load(); }
    catch { throw new Error(kind === 'submit' ? 'Your submission was accepted, but the board could not refresh. Refresh My Bounties; do not submit it again.'
      : kind === 'withdrawal' ? 'Your withdrawal was recorded, but the wallet could not refresh. Check withdrawal history before creating another request.'
        : 'Your change was saved, but the screen could not refresh. Please reload.'); }
  }
  return {
    load,
    submit: input => mutate(() => playerBounties.submit(input.taskId, { postUrl: input.postUrl, evidenceUrl: input.evidenceUrl, evidenceNotes: input.evidenceNotes, confirmed: input.confirmed as true, termsRevision: input.termsRevision }), 'submit'),
    saveAddress: address => mutate(() => playerBounties.address(address)),
    requestWithdrawal: input => {
      const fingerprint = JSON.stringify([input.address.trim().toLowerCase(), input.amountMicros]);
      if (pendingWithdrawal && pendingWithdrawal.fingerprint !== fingerprint) return Promise.reject(new Error('An earlier withdrawal response is uncertain. Retry its original amount and destination or refresh history before changing the request.'));
      pendingWithdrawal ??= { fingerprint, key: crypto.randomUUID() };
      try { sessionStorage.setItem(retryStorage, JSON.stringify(pendingWithdrawal)); } catch { /* In-memory fallback. */ }
      const key = pendingWithdrawal.key;
      return mutate(async () => {
        try { await playerBounties.withdraw({ address: input.address, amountMicros: String(input.amountMicros), confirmed: input.confirmed as true }, key); }
        catch (error) {
          if ((error as {status?:number}).status === 400 || (error instanceof Error && error.message === 'insufficient_balance')) {
            pendingWithdrawal = undefined; try { sessionStorage.removeItem(retryStorage); } catch { /* Optional storage. */ }
          }
          throw error;
        }
      }, 'withdrawal').then(snapshot => {
        // Only a confirmed mutation + successful refresh may finish this intent.
        // A background poll must NOT clear it while an uncertain dialog can still retry.
        pendingWithdrawal = undefined; try { sessionStorage.removeItem(retryStorage); } catch { /* Optional storage. */ }
        return snapshot;
      });
    },
    markNotificationsRead: () => mutate(() => playerBounties.read()),
    more: async kind => { pageCounts[kind]++; try { return await load(); } catch (error) { pageCounts[kind]--; throw error; } },
  };
}
