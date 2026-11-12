import mongoose from 'mongoose';
import { MAX_MICROS } from './validation.js';

const { Schema } = mongoose;
const money = () => ({ type: Schema.Types.BigInt, default: 0n,
  validate: { validator: value => typeof value === 'bigint' && value >= 0n && value <= MAX_MICROS, message: 'USDC integer outside accounting bounds' } });
const player = () => ({ type: Schema.Types.ObjectId, ref: 'User', required: true, index: true });
const options = { timestamps: true, optimisticConcurrency: true };
const terms = new Schema({
  title: { type: String, required: true }, description: { type: String, required: true },
  platform: { type: String, enum: ['x', 'tiktok'], required: true },
  instructions: [String], disclosure: String, evidenceRequired: Boolean,
  minimumEngagement: { type: Number, required: true }, rewardMicros: money(), revision: Number,
  rewardMode: { type: String, enum: ['fixed', 'manual'], default: 'fixed' },
}, { _id: false });
const taskSchema = new Schema({
  terms: { type: terms, required: true }, status: { type: String, enum: ['draft', 'active', 'paused', 'closed'], default: 'draft', index: true },
  budgetMicros: money(), committedMicros: money(), rewardedMicros: money(),
  // Historical caps remain readable; no new bounty enforces a budget or participant cap.
  participationLimit: { type: Number, default: null }, participants: { type: Number, default: 0 },
  publishedAt: Date, startsAt: { type: Date, default: null }, expiresAt: { type: Date, default: null },
}, options);
export const BountyTask = mongoose.model('BountyTask', taskSchema);

const accountSchema = new Schema({
  playerId: { ...player(), unique: true }, availableMicros: money(), reservedMicros: money(),
  pendingMicros: money(), earnedMicros: money(), withdrawnMicros: money(),
  address: { type: String, default: '' }, notificationsReadAt: { type: Date, default: () => new Date(0) },
}, options);
export const BountyAccount = mongoose.model('BountyAccount', accountSchema);
const submissionSchema = new Schema({
  playerId: player(), taskId: { type: Schema.Types.ObjectId, required: true, index: true },
  terms: { type: terms, required: true, immutable: true },
  postKey: { type: String, required: true, immutable: true }, postUrl: { type: String, required: true, immutable: true },
  evidenceUrl: String, evidenceNotes: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  riskFlags: [String], ipHash: { type: String, index: true },
  review: { type: Schema.Types.Mixed, default: null }, reviewedAt: Date,
  awardedMicros: { type: Schema.Types.BigInt, default: null, validate: value => value === null || (value > 0n && value <= MAX_MICROS) },
}, options);
submissionSchema.index({ playerId: 1, taskId: 1 }, { unique: true });
submissionSchema.index({ postKey: 1 }, { unique: true });
submissionSchema.index({ status: 1, _id: -1 });
export const BountySubmission = mongoose.model('BountySubmission', submissionSchema);

const withdrawalSchema = new Schema({
  playerId: player(), requestKey: { type: String, required: true },
  amountMicros: { ...money(), immutable: true }, address: { type: String, required: true, immutable: true },
  status: { type: String, enum: ['pending', 'approved', 'prepared', 'broadcast', 'paid', 'rejected', 'failed'], default: 'pending', index: true },
  riskFlags: [String], review: { type: Schema.Types.Mixed, default: null },
  // Never serialized to player/admin API responses. A committed intent exists BEFORE any broadcast.
  rawTransaction: { type: String, select: false },
  txHash: String, treasury: String, nonce: Number, chainId: Number,
  receiptBlock: String, failureReason: String, paidAt: Date,
  paymentMethod: { type: String, enum: ['manual'] },
  paymentConfirmation: { type: Schema.Types.Mixed, default: null },
}, options);
withdrawalSchema.index({ playerId: 1, requestKey: 1 }, { unique: true });
withdrawalSchema.index({ txHash: 1 }, { unique: true, partialFilterExpression: { txHash: { $type: 'string' } } });
export const BountyWithdrawal = mongoose.model('BountyWithdrawal', withdrawalSchema);

const ledgerSchema = new Schema({
  playerId: player(), eventKey: { type: String, unique: true, required: true },
  kind: { type: String, enum: ['reward', 'withdrawal_reserved', 'withdrawal_paid', 'withdrawal_released'], required: true },
  amountMicros: money(), referenceId: { type: Schema.Types.ObjectId, required: true },
  availableAfterMicros: money(), reservedAfterMicros: money(),
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });
// Financial history is append-only through the application, including document operations.
for (const hook of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  ledgerSchema.pre(hook, function () { throw new Error('immutable_bounty_ledger'); });
}
ledgerSchema.pre('save', function () { if (!this.isNew) throw new Error('immutable_bounty_ledger'); });
ledgerSchema.index({ playerId: 1, _id: -1 });
export const BountyLedger = mongoose.model('BountyLedger', ledgerSchema);
const auditSchema = new Schema({
  actor: { type: String, required: true }, action: { type: String, required: true },
  referenceId: Schema.Types.ObjectId, details: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });
for (const hook of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  auditSchema.pre(hook, function () { throw new Error('immutable_bounty_audit'); });
}
auditSchema.pre('save', function () { if (!this.isNew) throw new Error('immutable_bounty_audit'); });
export const BountyAudit = mongoose.model('BountyAudit', auditSchema);
const noticeSchema = new Schema({
  playerId: { type: Schema.Types.ObjectId, default: null, index: true },
  kind: { type: String, enum: ['published', 'received', 'approved', 'rejected', 'credited', 'withdrawal'], required: true },
  referenceId: Schema.Types.ObjectId, message: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
noticeSchema.index({ playerId: 1, _id: -1 });
export const BountyNotice = mongoose.model('BountyNotice', noticeSchema);
// This lane never expires. Uncertain transactions must not be replaced with a fresh nonce.
export const BountyTreasuryLane = mongoose.model('BountyTreasuryLane', new Schema({
  _id: String, activeWithdrawalId: { type: Schema.Types.ObjectId, default: null },
}));
export const BountyRateBucket = mongoose.model('BountyRateBucket', new Schema({
  _id: String, count: { type: Number, default: 0 }, expiresAt: { type: Date, required: true },
}));
BountyRateBucket.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const bountyModels = [BountyTask, BountyAccount, BountySubmission, BountyWithdrawal, BountyLedger, BountyAudit, BountyNotice, BountyTreasuryLane, BountyRateBucket];
export async function initializeBounties() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Bounty accounting requires a MongoDB replica set or sharded cluster');
  // No drop/syncIndexes: ensure uniqueness before the server starts accepting writes.
  for (const model of bountyModels) await model.createIndexes();
  await BountyTreasuryLane.updateOne({ _id: 'base-usdc' }, { $setOnInsert: { activeWithdrawalId: null } }, { upsert: true });
  // Upgrade future task terms only. Existing submission snapshots and all money
  // records remain unchanged; cached old briefs fail the revision check.
  let changed;
  do {
    changed = await mongoose.connection.transaction(async session => {
      const tasks = await BountyTask.find({ 'terms.rewardMode': { $ne: 'manual' } }).limit(50).session(session);
      for (const task of tasks) {
        const previousReward = task.terms.rewardMicros.toString();
        task.terms.rewardMode = 'manual'; task.terms.rewardMicros = 0n;
        task.terms.revision = (task.terms.revision || 0) + 1; task.participationLimit = null;
        await task.save({ session });
        await BountyAudit.create([{ actor: 'system:manual-bounty-upgrade', action: 'task_manual_rewards_enabled', referenceId: task._id,
          details: { previousRewardMicros: previousReward, existingSubmissionsPreserved: true, revision: task.terms.revision } }], { session });
      }
      return tasks.length;
    });
  } while (changed);
}
