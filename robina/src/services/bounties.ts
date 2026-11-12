import { API_BASE_URL } from '@/lib/backend';
import { httpRequest } from './http';
import type { BountyTask, TaskInput, SubmissionInput, SubmissionReview, WithdrawalInput, WithdrawalReview, ManualPaymentInput, BountySubmission, BountyWithdrawal, BountyWallet, BountyNotification, LedgerEntry, Page, AdminAccount, AdminSubmission, AdminWithdrawal, BountySummary, PlayerDetail, AuditEntry } from '../../../backend/src/bounties/contracts';
export type { AdminPlayer } from '../../../backend/src/bounties/contracts';
export type { BountyTask, TaskInput, SubmissionReview, WithdrawalReview, BountySubmission, BountyWithdrawal, BountyWallet, BountyNotification, LedgerEntry, Page, AdminAccount, AdminSubmission, AdminWithdrawal, BountySummary, PlayerDetail, AuditEntry };

export function bountyRequest<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal, key?: string): Promise<T> {
  return httpRequest<T>(API_BASE_URL + path, { method, ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}),
    headers: { 'X-Rivals-Bounty': '1', ...(key ? { 'Idempotency-Key': key } : {}) } }, { signal, timeoutMs: 30000, retries: 0 });
}
export function queryString(query: Record<string, string | undefined>) {
  const params = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  return '?' + params.toString();
}
export const playerBounties = {
  list: <T>(kind: string, before?: string, signal?: AbortSignal) => bountyRequest<Page<T>>('/api/bounties/' + kind + queryString({ limit: '20', before }), 'GET', undefined, signal),
  wallet: (signal?: AbortSignal) => bountyRequest<BountyWallet>('/api/bounties/wallet', 'GET', undefined, signal),
  submit: (id: string, body: SubmissionInput) => bountyRequest<BountySubmission>(`/api/bounties/tasks/${id}/submissions`, 'POST', body),
  address: (address: string) => bountyRequest('/api/bounties/wallet/address', 'PUT', { address }),
  withdraw: (body: WithdrawalInput, key: string) => bountyRequest<BountyWithdrawal>('/api/bounties/withdrawals', 'POST', body, undefined, key),
  read: () => bountyRequest('/api/bounties/notifications/read', 'POST', {}),
};
const root = '/api/admin/bounties';
export const adminBounties = {
  summary: (signal?: AbortSignal) => bountyRequest<BountySummary>(root + '/summary', 'GET', undefined, signal),
  list: <T>(kind: string, query: Record<string, string | undefined>, signal?: AbortSignal) => bountyRequest<Page<T>>(root + '/' + kind + queryString({ limit: '20', ...query }), 'GET', undefined, signal),
  create: (body: TaskInput) => bountyRequest<BountyTask>(root + '/tasks', 'POST', body),
  edit: (id: string, body: TaskInput) => bountyRequest<BountyTask>(root + '/tasks/' + id, 'PUT', body),
  status: (id: string, status: string) => bountyRequest<BountyTask>(root + '/tasks/' + id + '/status', 'PATCH', { status }),
  reviewSubmission: (id: string, body: SubmissionReview) => bountyRequest<BountySubmission>(root + '/submissions/' + id + '/review', 'POST', body),
  reviewWithdrawal: (id: string, body: WithdrawalReview) => bountyRequest<BountyWithdrawal>(root + '/withdrawals/' + id + '/review', 'POST', body),
  markPaid: (id: string, body: ManualPaymentInput) => bountyRequest<BountyWithdrawal>(root + '/withdrawals/' + id + '/paid', 'POST', body),
  payout: (id: string, action: 'execute' | 'reconcile') => bountyRequest<BountyWithdrawal>(root + '/withdrawals/' + id + '/' + action, 'POST', {}),
  player: (id: string, signal?: AbortSignal) => bountyRequest<PlayerDetail>(root + '/players/' + id, 'GET', undefined, signal),
};
const messages: Record<string, string> = {
  reward_amount_conflict: 'This submission was already credited with a different amount. Refresh its record; it cannot be credited again.',
  reward_below_promised_amount: 'This older submission has a promised minimum reward. Do not enter a smaller amount.',
  payout_transaction_already_recorded: 'This transaction hash is already recorded for another withdrawal. Check your wallet and audit history; do not pay again.',
  legacy_payment_requires_reconciliation: 'An older signed payment may already be on chain. Do not pay or refund it manually; reconcile the original transaction.',
  withdrawal_not_payable: 'This request is no longer pending. Refresh its payment record before taking any action.',
  withdrawal_already_paid: 'This withdrawal is already paid. Its payment record cannot be changed or debited again.',
  automatic_payouts_retired: 'Automatic transfers are retired. Pay externally in your Base wallet, then record payment with Mark Paid.',
  unauthenticated: 'Your session has expired. Sign in again to continue.', invalid_token: 'Your session has expired. Sign in again to continue.',
  token_revoked: 'Your session has expired. Sign in again to continue.', session_expired: 'Your session has expired. Sign in again to continue.',
  invalid_admin_session: 'Your admin session has expired. Sign in again.',
  service_unavailable: 'The bounty service is unavailable. Please try again.', invalid_request: 'Check the form values and required confirmations.',
  already_submitted: 'You have already submitted this contract. Open My Bounties to see its status.', post_already_submitted: 'This post has already been submitted. Each original post can be used once.',
  duplicate_record: 'This submission or request already exists. Refresh to see its current status.',
  insufficient_balance: 'Your available USDC balance is insufficient. Refresh your wallet.', campaign_budget_exhausted: 'This campaign has reached its reward budget.',
  participation_limit: 'This campaign has reached its participation limit.', task_outside_schedule: 'This campaign is not open for submissions at this time.',
  task_not_active: 'This campaign is not accepting submissions.', task_expired: 'The campaign expiration date has passed.',
  task_terms_changed: 'The campaign terms changed after you opened the brief. Close it, refresh the board and review the new terms before submitting.',
  invalid_post_url: 'Use a full public X status URL or TikTok video URL for the correct platform.', invalid_evidence_url: 'Use a public HTTPS evidence link without credentials or local addresses.',
  invalid_base_address: 'Enter a valid non-zero Base wallet address with the correct checksum.', bounty_rate_limited: 'Too many requests. Please try again later.',
  budget_or_limit_below_commitments: 'The budget or participation limit cannot be lower than existing commitments.',
  engagement_requirement_not_met: 'Verified engagement does not meet the promised requirement.', risk_acknowledgement_required: 'Review the activity risks and explicitly acknowledge them before approval.',
  bounty_payouts_not_configured: 'Live payouts are not configured. Funds remain reserved; no payment has been confirmed.',
  treasury_busy_reconcile_active_withdrawal: 'Another treasury payment is unresolved. Reconcile the active prepared/broadcast withdrawal first.',
  treasury_usdc_insufficient: 'The treasury needs more native USDC on Base. This unsigned request remains authorized, not paid.',
  treasury_gas_insufficient: 'The treasury needs ETH on Base for gas. No payment has been confirmed.',
  treasury_gas_limit: 'Network fees exceed the configured safety limit. No payment has been confirmed.',
  payout_above_treasury_limit: 'This request exceeds the treasury per-payment safety limit. Review server configuration or cancel while unsigned.',
  request_timeout: 'The response timed out. The operation may have reached the server. Refresh its status before taking another action.',
  idempotency_key_conflict: 'A previous request used this retry key with different details. Refresh your withdrawal history.',
};
export function bountyError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (error instanceof TypeError) return 'Could not connect to the bounty service. Check your connection and try again.';
  return messages[code] || 'The action could not be confirmed. Refresh to check the latest server status, then try again if needed.';
}
