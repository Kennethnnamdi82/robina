/** Phase 3 wire contracts. USDC amounts are integer micro-unit DECIMAL STRINGS, never floats. */
export type UsdcMicros = string;
export type ObjectId = string;
export type Platform = 'x' | 'tiktok';
export interface TaskTerms {
  title: string;
  description: string;
  platform: Platform;
  instructions: string[];
  disclosure: string;
  evidenceRequired: boolean;
  minimumEngagement: number;
  rewardMicros: UsdcMicros;
  revision: number;
}
export interface TaskInput extends Omit<TaskTerms, 'revision'> {
  budgetMicros: UsdcMicros;
  participationLimit: number;
  startsAt?: string | null;
  expiresAt?: string | null;
}
export interface BountyTask {
  _id: ObjectId;
  terms: TaskTerms;
  status: 'draft' | 'active' | 'paused' | 'closed';
  budgetMicros: UsdcMicros;
  committedMicros: UsdcMicros;
  rewardedMicros: UsdcMicros;
  participationLimit: number;
  participants: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  participation?: { _id: string; taskId: string; status: 'pending' | 'approved' | 'rejected' } | null;
}
export interface SubmissionInput {
  postUrl: string;
  evidenceUrl?: string;
  evidenceNotes?: string;
  confirmed: true;
  termsRevision?: number;
}
export type SubmissionReview = {
  decision: 'approve';
  verificationMethod: 'manual';
  ownershipVerified: true;
  engagementVerified: true;
  complianceVerified: true;
  disclosureVerified: true;
  observedEngagement: number;
  notes: string;
  acknowledgeRisk?: boolean;
} | { decision: 'reject'; reason: string };
export interface BountySubmission extends Omit<SubmissionInput, 'confirmed'> {
  _id: ObjectId;
  playerId: ObjectId;
  taskId: ObjectId;
  terms: TaskTerms;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  review?: { decision: 'approve' | 'reject'; reason?: string };
}
export interface BountyBalances {
  availableMicros: UsdcMicros;
  reservedMicros: UsdcMicros;
  pendingMicros: UsdcMicros;
  earnedMicros: UsdcMicros;
  withdrawnMicros: UsdcMicros;
  address: string;
}
export interface BountyWallet extends BountyBalances {
  minimumWithdrawalMicros: '5000000';
  currency: 'USDC';
  chainId: 8453;
  payoutsEnabled: boolean;
}
export interface WithdrawalInput { amountMicros: UsdcMicros; address: string; confirmed: true }
export type WithdrawalReview = { decision: 'approve'; notes: string; acknowledgeRisk?: boolean } | { decision: 'reject'; reason: string };
export interface BountyWithdrawal {
  _id: ObjectId;
  requestKey?: string;
  playerId: ObjectId;
  amountMicros: UsdcMicros;
  address: string;
  status: 'pending' | 'approved' | 'prepared' | 'broadcast' | 'paid' | 'rejected' | 'failed';
  createdAt: string;
  updatedAt: string;
  txHash?: string;
  chainId?: 8453;
  receiptBlock?: string;
  paidAt?: string;
  failureReason?: string;
  review?: { decision: 'approve' | 'reject'; reason?: string };
}
export interface LedgerEntry {
  _id: ObjectId;
  playerId: ObjectId;
  eventKey: string;
  kind: 'reward' | 'withdrawal_reserved' | 'withdrawal_paid' | 'withdrawal_released';
  amountMicros: UsdcMicros;
  referenceId: ObjectId;
  availableAfterMicros: UsdcMicros;
  reservedAfterMicros: UsdcMicros;
  createdAt: string;
}
export interface BountyNotification {
  _id: ObjectId;
  playerId: ObjectId | null;
  kind: 'published' | 'received' | 'approved' | 'rejected' | 'credited' | 'withdrawal';
  referenceId: ObjectId;
  message: string;
  createdAt: string;
  read: boolean;
}
export interface Page<T> { items: T[]; nextBefore: ObjectId | null }
export interface AdminPlayer { _id: string; wallet: string; walletAddress?: string | null; email?: string | null; accountStatus: string }
export interface AdminSubmission extends BountySubmission { player?: AdminPlayer; riskFlags: string[]; wallet?: BountyBalances }
export interface AdminWithdrawal extends BountyWithdrawal { player?: AdminPlayer; riskFlags: string[]; wallet?: BountyBalances }
export interface AdminAccount extends BountyBalances { _id: string; playerId: string; player?: AdminPlayer; approvedTasks: number; riskFlags: string[] }
export interface BountySummary {
  activeBounties: number; totalBounties: number; totalSubmissions: number;
  pendingApprovals: number; approvedSubmissions: number; pendingWithdrawals: number;
  rewardsIssuedMicros: string; availableMicros: string; outstandingMicros: string;
  reservedMicros: string; withdrawnMicros: string; payoutsEnabled: boolean;
}
export interface AuditEntry { _id: string; actor: string; action: string; referenceId: string; details: Record<string, unknown>; createdAt: string }
export interface PlayerDetail { player: AdminPlayer; wallet: BountyBalances; approvedTasks: number; riskFlags: string[] }
