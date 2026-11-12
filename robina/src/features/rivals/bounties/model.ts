import { z } from 'zod';

export const USDC = 1_000_000;
export const MIN_WITHDRAWAL = 5 * USDC;
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const submissionStatus = z.enum(['pending_review', 'approved', 'rejected', 'completed']);
export type SubmissionStatus = z.infer<typeof submissionStatus>;
export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending_review: 'Pending Review', approved: 'Approved', rejected: 'Rejected', completed: 'Completed',
};
export interface BountyTask {
  id: string;
  platform: 'x' | 'tiktok';
  title: string;
  description: string;
  requirement: string;
  rewardMicros: number;
  rewardMode?: 'fixed' | 'manual';
  status: 'active' | 'closed';
  instructions: string[];
  disclosure: string;
  evidenceRequired: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  revision?: number;
  submitted?: boolean;
  submissionStatus?: SubmissionStatus;
}
const submissionSchema = z.object({
  id: z.string(), taskId: z.string(), taskTitle: z.string(), platform: z.enum(['x', 'tiktok']),
  postUrl: z.string(), evidenceUrl: z.string(), evidenceNotes: z.string(),
  rewardMicros: amount, rewardMode: z.enum(['fixed', 'manual']).optional(), status: submissionStatus, submittedAt: z.string().datetime(),
  rejectionReason: z.string().optional(),
});
export type BountySubmission = z.infer<typeof submissionSchema>;
export const notificationKind = z.enum(['published', 'received', 'approved', 'rejected', 'credited', 'withdrawal']);
export type NotificationKind = z.infer<typeof notificationKind>;
const notificationSchema = z.object({
  id: z.string(), kind: notificationKind, title: z.string(), message: z.string(),
  createdAt: z.string().datetime(), read: z.boolean(),
});
export type BountyNotification = z.infer<typeof notificationSchema>;
const withdrawalSchema = z.object({
  id: z.string(), amountMicros: amount, address: z.string(), requestedAt: z.string().datetime(),
  status: z.enum(['requested', 'processing', 'pending', 'approved', 'prepared', 'broadcast', 'paid', 'rejected', 'failed']),
  reason: z.string().optional(), transactionUrl: z.string().optional(),
  paymentMethod: z.literal('manual').optional(),
});
export type BountyWithdrawal = z.infer<typeof withdrawalSchema>;
export const demoStateSchema = z.object({
  version: z.literal(1), submissions: z.array(submissionSchema), notifications: z.array(notificationSchema),
  wallet: z.object({ availableMicros: amount, earnedMicros: amount, withdrawnMicros: amount, address: z.string() }),
  withdrawals: z.array(withdrawalSchema),
});
export type DemoState = z.infer<typeof demoStateSchema>;
export interface BountySnapshot extends DemoState {
  tasks: BountyTask[];
  mode: 'demo' | 'live';
  persistence: 'device' | 'session' | 'server';
  payoutsEnabled?: boolean;
  wallet: DemoState['wallet'] & { pendingMicros?: number; reservedMicros?: number; pendingSubmissions?: number };
  ledger?: import('@/services/bounties').LedgerEntry[];
  more?: Partial<Record<'submissions' | 'withdrawals' | 'notifications' | 'ledger', boolean>>;
  unavailable?: Array<'submissions' | 'withdrawals' | 'notifications' | 'ledger'>;
}
export interface SubmitBountyInput {
  taskId: string;
  postUrl: string;
  evidenceUrl: string;
  evidenceNotes: string;
  confirmed: boolean;
  termsRevision?: number;
}
export interface WithdrawInput { address: string; amountMicros: number; confirmed: boolean }

/** Phase 2 seam: replace the demo gateway, not the view components.
 * The authenticated server must own eligibility, uniqueness, review and ALL balances.
 * Mutations return an authoritative snapshot; the client never awards rewards.
 */
export interface BountyGateway {
  load(signal?: AbortSignal): Promise<BountySnapshot>;
  submit(input: SubmitBountyInput): Promise<BountySnapshot>;
  saveAddress(address: string): Promise<BountySnapshot>;
  requestWithdrawal(input: WithdrawInput): Promise<BountySnapshot>;
  markNotificationsRead(): Promise<BountySnapshot>;
  more?(kind: 'submissions' | 'withdrawals' | 'notifications' | 'ledger'): Promise<BountySnapshot>;
}
export const money = (micros: number) => {
  const value = BigInt(micros), fraction = (value % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return (value / 1_000_000n).toLocaleString() + '.' + fraction;
};
export const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
export function parseUSDC(value: string): number | null {
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(value.trim())) return null;
  const [whole, decimal = ''] = value.trim().split('.');
  return Number(whole) * USDC + Number(decimal.padEnd(6, '0'));
}
export const validBaseAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value.trim()) && !/^0x0{40}$/i.test(value.trim());
export function safeWebUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return url.href;
  } catch { return null; }
}
export function validPostUrl(platform: BountyTask['platform'], value: string): string | null {
  const safe = safeWebUrl(value);
  if (!safe) return null;
  const url = new URL(safe), host = url.hostname.toLowerCase();
  const valid = platform === 'x'
    ? ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(host) && /^\/(?:[a-zA-Z0-9_]{1,15}\/status|i\/web\/status)\/\d+\/?$/.test(url.pathname)
    : ['tiktok.com', 'www.tiktok.com'].includes(host) && /^\/@[a-zA-Z0-9_.]+\/video\/\d+\/?$/.test(url.pathname);
  if (!valid) return null;
  url.search = ''; url.hash = '';
  return url.href;
}
export function submissionError(task: BountyTask, input: SubmitBountyInput): string | null {
  if (task.status !== 'active') return 'This bounty is closed.';
  if (!validPostUrl(task.platform, input.postUrl)) return `Enter a full HTTPS ${task.platform === 'x' ? 'X / Twitter status' : 'TikTok @creator/video'} URL. Short links are not supported.`;
  if (task.evidenceRequired && !safeWebUrl(input.evidenceUrl)) return 'Add an HTTPS link to your engagement evidence.';
  if (input.evidenceUrl && !safeWebUrl(input.evidenceUrl)) return 'Use a valid HTTPS evidence link.';
  if (input.postUrl.length > 2048 || input.evidenceUrl.length > 2048 || input.evidenceNotes.length > 1500) return 'Your submission exceeds the allowed length.';
  if (!input.confirmed) return 'Confirm originality, genuine engagement and promotional disclosure.';
  return null;
}
export const pendingRewards = (submissions: BountySubmission[]) => submissions.filter(s => s.status === 'pending_review' || s.status === 'approved').reduce((sum, s) => sum + s.rewardMicros, 0);
