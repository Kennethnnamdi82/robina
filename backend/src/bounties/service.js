import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { BountyTask, BountyAccount, BountySubmission, BountyWithdrawal, BountyLedger, BountyAudit, BountyNotice, BountyTreasuryLane, BountyRateBucket } from './models.js';
import { MAX_MICROS, fail, parse, taskInput, taskStatusInput, submitInput, normalizePost, evidenceUrl, reviewInput, withdrawalInput, baseAddress, idempotencyKey, withdrawalReviewInput, manualPaymentInput } from './validation.js';

const txOptions = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 10_000 };
export async function atomic(work) {
  try { return await mongoose.connection.transaction(work, txOptions); }
  catch (error) {
    if (error.code === 11000) fail('duplicate_record');
    throw error;
  }
}
async function accountFor(playerId, session) {
  return BountyAccount.findOneAndUpdate({ playerId }, { $setOnInsert: { playerId } }, { upsert: true, new: true, session });
}
async function audit(session, actor, action, referenceId, details = {}) {
  await BountyAudit.create([{ actor, action, referenceId, details }], { session });
}
async function notice(session, playerId, kind, referenceId, message) {
  await BountyNotice.create([{ playerId, kind, referenceId, message }], { session });
}
async function ledger(session, account, kind, eventKey, referenceId, amountMicros) {
  await BountyLedger.create([{ playerId: account.playerId, kind, eventKey, referenceId, amountMicros,
    availableAfterMicros: account.availableMicros, reservedAfterMicros: account.reservedMicros }], { session });
}
function bounded(account) {
  for (const key of ['availableMicros', 'reservedMicros', 'pendingMicros', 'earnedMicros', 'withdrawnMicros']) {
    if (account[key] < 0n || account[key] > MAX_MICROS) fail('accounting_limit', 409);
  }
  if (account.earnedMicros !== account.availableMicros + account.reservedMicros + account.withdrawnMicros) fail('bounty_ledger_invariant');
}
function termsFrom(input, revision) {
  const { startsAt: _start, expiresAt: _end, ...terms } = input;
  return { ...terms, rewardMode: 'manual', rewardMicros: 0n, revision };
}
export function hashIp(ip) {
  return crypto.createHmac('sha256', env.jwtSecret).update(`bounty-ip:${ip}`).digest('hex');
}

// Persistent, shared across workers; no Redis and no reliance on spoofable forwarding headers.
export async function consumeRate(key, maximum, windowMs = 3_600_000) {
  const slot = Math.floor(Date.now() / windowMs);
  let bucket;
  try {
    bucket = await BountyRateBucket.findOneAndUpdate({ _id: `${key}:${slot}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((slot + 2) * windowMs) } }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    bucket = await BountyRateBucket.findOneAndUpdate({ _id: `${key}:${slot}` }, { $inc: { count: 1 } }, { new: true });
  }
  if (!bucket) fail('bounty_rate_unavailable', 503);
  if (bucket.count > maximum) fail('bounty_rate_limited', 429);
}

export async function createTask(actor, input) {
  const data = parse(taskInput, input);
  return atomic(async session => {
    const [task] = await BountyTask.create([{ terms: termsFrom(data, 1), startsAt: data.startsAt, expiresAt: data.expiresAt }], { session });
    await audit(session, actor, 'task_created', task._id, data);
    return task;
  });
}
export async function editTask(actor, id, input) {
  const data = parse(taskInput, input);
  return atomic(async session => {
    const task = await BountyTask.findById(id).session(session);
    if (!task) fail('task_not_found', 404);
    if (task.status === 'closed') fail('task_closed');
    task.terms = termsFrom(data, task.terms.revision + 1);
    task.participationLimit = null;
    task.startsAt = data.startsAt; task.expiresAt = data.expiresAt;
    await task.save({ session });
    await audit(session, actor, 'task_edited', task._id, data);
    return task;
  });
}
export async function changeTaskStatus(actor, id, input) {
  const { status } = parse(taskStatusInput, input);
  return atomic(async session => {
    const task = await BountyTask.findById(id).session(session);
    if (!task) fail('task_not_found', 404);
    if (task.status === status) return task;
    if (task.status === 'closed' || (task.status === 'draft' && status === 'paused')) fail('invalid_task_transition');
    if (status === 'active' && task.expiresAt && task.expiresAt <= new Date()) fail('task_expired');
    task.status = status;
    if (status === 'active' && !task.publishedAt) {
      task.publishedAt = new Date();
      await notice(session, null, 'published', task._id, `New bounty: ${task.terms.title}`);
    }
    await task.save({ session });
    await audit(session, actor, `task_${status}`, task._id);
    return task;
  });
}
export async function submit(playerId, taskId, input, ipHash) {
  const data = parse(submitInput, input);
  return atomic(async session => {
    const task = await BountyTask.findById(taskId).session(session);
    if (!task) fail('task_not_found', 404);
    if (task.status !== 'active') fail('task_not_active');
    if ((task.startsAt && task.startsAt > new Date()) || (task.expiresAt && task.expiresAt <= new Date())) fail('task_outside_schedule');
    if (data.termsRevision !== undefined && data.termsRevision !== task.terms.revision) fail('task_terms_changed');
    const post = normalizePost(task.terms.platform, data.postUrl);
    const evidence = evidenceUrl(data.evidenceUrl);
    if (task.terms.evidenceRequired && !evidence) fail('evidence_required', 400);
    if (await BountySubmission.exists({ playerId, taskId }).session(session)) fail('already_submitted');
    if (await BountySubmission.exists({ postKey: post.postKey }).session(session)) fail('post_already_submitted');
    const user = await User.findById(playerId).session(session);
    if (!user) fail('player_not_found', 404);
    const riskFlags = [];
    const related = await BountySubmission.distinct('playerId', { ipHash, playerId: { $ne: playerId } }).session(session);
    if (related.length >= 3) riskFlags.push('shared_submission_network');
    if (user.email && await User.exists({ _id: { $ne: playerId }, email: user.email }).session(session)) riskFlags.push('shared_account_email');
    const account = await accountFor(playerId, session);
    account.pendingMicros += task.terms.rewardMicros; bounded(account);
    await account.save({ session });
    task.participants += 1; task.committedMicros += task.terms.rewardMicros;
    await task.save({ session });
    const [submission] = await BountySubmission.create([{ playerId, taskId, terms: task.terms.toObject(), ...post,
      evidenceUrl: evidence, evidenceNotes: data.evidenceNotes, ipHash, riskFlags }], { session });
    await notice(session, playerId, 'received', submission._id, 'Submission received. Pending manual review; no reward credited.');
    await audit(session, String(playerId), 'submission_created', submission._id, { taskId, riskFlags });
    return submission;
  });
}
export async function reviewSubmission(actor, id, input) {
  const review = parse(reviewInput, input);
  return atomic(async session => {
    const submission = await BountySubmission.findById(id).session(session);
    if (!submission) fail('submission_not_found', 404);
    if (submission.status !== 'pending') {
      if (submission.status === (review.decision === 'approve' ? 'approved' : 'rejected')) {
        if (review.decision === 'approve' && BigInt(review.rewardMicros) !== (submission.awardedMicros ?? submission.terms.rewardMicros)) fail('reward_amount_conflict');
        return submission;
      }
      fail('submission_already_reviewed');
    }
    const account = await accountFor(submission.playerId, session);
    const promised = submission.terms.rewardMicros;
    account.pendingMicros -= promised;
    if (review.decision === 'approve') {
      const reward = BigInt(review.rewardMicros);
      // Never reduce an older submission's explicitly advertised fixed reward.
      if (submission.terms.rewardMode !== 'manual' && reward < promised) fail('reward_below_promised_amount', 400);
      if (review.observedEngagement < submission.terms.minimumEngagement) fail('engagement_requirement_not_met', 400);
      // Recheck at review time: related accounts may have appeared after submission.
      const user = await User.findById(submission.playerId).session(session);
      if (user?.email && await User.exists({ _id: { $ne: user._id }, email: user.email }).session(session) &&
          !submission.riskFlags.includes('shared_account_email')) submission.riskFlags.push('shared_account_email');
      const related = await BountySubmission.distinct('playerId', { ipHash: submission.ipHash, playerId: { $ne: submission.playerId } }).session(session);
      if (related.length >= 3 && !submission.riskFlags.includes('shared_submission_network')) submission.riskFlags.push('shared_submission_network');
      if (submission.riskFlags.length && !review.acknowledgeRisk) fail('risk_acknowledgement_required', 400);
      account.availableMicros += reward; account.earnedMicros += reward;
      submission.awardedMicros = reward;
      submission.status = 'approved';
      const task = await BountyTask.findById(submission.taskId).session(session);
      if (!task) fail('task_not_found', 404);
      task.rewardedMicros += reward; await task.save({ session });
      bounded(account); await account.save({ session });
      await ledger(session, account, 'reward', `reward:${id}`, submission._id, reward);
      await notice(session, submission.playerId, 'approved', submission._id, 'Submission approved after manual verification.');
      const displayReward = `${reward / 1_000_000n}.${(reward % 1_000_000n).toString().padStart(6, '0')}`.replace(/\.?0+$/, '');
      await notice(session, submission.playerId, 'credited', submission._id, `${displayReward} USDC credited to your bounty balance.`);
    } else {
      submission.status = 'rejected';
      const task = await BountyTask.findById(submission.taskId).session(session);
      if (!task) fail('task_not_found', 404);
      task.committedMicros -= promised; await task.save({ session });
      bounded(account); await account.save({ session });
      await notice(session, submission.playerId, 'rejected', submission._id, review.reason);
    }
    submission.review = { ...review, actor }; submission.reviewedAt = new Date();
    await submission.save({ session });
    await audit(session, actor, `submission_${submission.status}`, submission._id, review);
    return submission;
  });
}

export async function saveAddress(playerId, address) {
  address = baseAddress(address);
  return atomic(async session => {
    const account = await accountFor(playerId, session);
    account.address = address; await account.save({ session });
    return account;
  });
}
export async function requestWithdrawal(playerId, key, input) {
  key = parse(idempotencyKey, key);
  const data = parse(withdrawalInput, input), address = baseAddress(data.address), amount = BigInt(data.amountMicros);
  return atomic(async session => {
    const previous = await BountyWithdrawal.findOne({ playerId, requestKey: key }).session(session);
    if (previous) {
      if (previous.amountMicros !== amount || previous.address !== address) fail('idempotency_key_conflict');
      return previous;
    }
    const account = await accountFor(playerId, session);
    if (account.availableMicros < amount) fail('insufficient_balance');
    const riskFlags = [];
    if (await BountyWithdrawal.exists({ playerId: { $ne: playerId }, address }).session(session)) riskFlags.push('shared_payout_address');
    const submissions = await BountySubmission.exists({ playerId, riskFlags: { $in: ['shared_submission_network', 'shared_account_email'] } }).session(session);
    if (submissions) riskFlags.push('flagged_submission_history');
    account.availableMicros -= amount; account.reservedMicros += amount; account.address = address;
    bounded(account); await account.save({ session });
    const [withdrawal] = await BountyWithdrawal.create([{ playerId, requestKey: key, amountMicros: amount, address, riskFlags }], { session });
    await ledger(session, account, 'withdrawal_reserved', `reserve:${withdrawal._id}`, withdrawal._id, amount);
    await notice(session, playerId, 'withdrawal', withdrawal._id, 'Withdrawal requested. Funds reserved while the administrator reviews and pays you manually on Base.');
    await audit(session, String(playerId), 'withdrawal_requested', withdrawal._id, { amountMicros: data.amountMicros, address, riskFlags });
    return withdrawal;
  });
}
export async function reviewWithdrawal(actor, id, input) {
  const review = parse(withdrawalReviewInput, input);
  return atomic(async session => {
    const withdrawal = await BountyWithdrawal.findById(id).select('+rawTransaction').session(session);
    if (!withdrawal) fail('withdrawal_not_found', 404);
    const target = review.decision === 'approve' ? 'approved' : 'rejected';
    if (withdrawal.rawTransaction) fail('legacy_payment_requires_reconciliation');
    if (withdrawal.status === target) return withdrawal;
    // An authorized but UNSIGNED request may still be cancelled. Preparation
    // changes this status atomically, so a racing cancellation cannot refund signed funds.
    if (withdrawal.status !== 'pending' && !(withdrawal.status === 'approved' && target === 'rejected')) fail('withdrawal_already_reviewed');
    if (review.decision === 'approve' && await BountyWithdrawal.exists({ playerId: { $ne: withdrawal.playerId }, address: withdrawal.address }).session(session) &&
        !withdrawal.riskFlags.includes('shared_payout_address')) withdrawal.riskFlags.push('shared_payout_address');
    if (review.decision === 'approve' && withdrawal.riskFlags.length && !review.acknowledgeRisk) fail('risk_acknowledgement_required', 400);
    withdrawal.status = target; withdrawal.review = { ...review, actor };
    if (target === 'rejected') {
      const account = await accountFor(withdrawal.playerId, session);
      account.reservedMicros -= withdrawal.amountMicros; account.availableMicros += withdrawal.amountMicros;
      bounded(account); await account.save({ session });
      await ledger(session, account, 'withdrawal_released', `release:${id}`, withdrawal._id, withdrawal.amountMicros);
    }
    await withdrawal.save({ session });
    await notice(session, withdrawal.playerId, 'withdrawal', withdrawal._id,
      target === 'approved' ? 'Withdrawal is being processed. The administrator will pay your Base address manually.' : review.reason);
    await audit(session, actor, `withdrawal_${target}`, withdrawal._id, review);
    return withdrawal;
  });
}

/** Records an owner's external payment; NEVER signs, sends or claims chain verification. */
export async function markWithdrawalPaid(actor, id, input) {
  const data = parse(manualPaymentInput, input);
  return atomic(async session => {
    const withdrawal = await BountyWithdrawal.findById(id).select('+rawTransaction').session(session);
    if (!withdrawal) fail('withdrawal_not_found', 404);
    if (withdrawal.status === 'paid') {
      if (withdrawal.paymentMethod !== 'manual' || (data.txHash && data.txHash !== withdrawal.txHash)) fail('withdrawal_already_paid');
      return withdrawal;
    }
    if (withdrawal.rawTransaction || ['prepared', 'broadcast'].includes(withdrawal.status)) fail('legacy_payment_requires_reconciliation');
    if (!['pending', 'approved'].includes(withdrawal.status)) fail('withdrawal_not_payable');
    if (withdrawal.riskFlags.length && !data.acknowledgeRisk) fail('risk_acknowledgement_required', 400);
    if (data.txHash && await BountyWithdrawal.exists({ _id: { $ne: withdrawal._id }, txHash: data.txHash }).session(session)) fail('payout_transaction_already_recorded');
    const account = await accountFor(withdrawal.playerId, session);
    account.reservedMicros -= withdrawal.amountMicros;
    account.withdrawnMicros += withdrawal.amountMicros;
    bounded(account); await account.save({ session });
    withdrawal.status = 'paid'; withdrawal.paidAt = new Date(); withdrawal.paymentMethod = 'manual'; withdrawal.chainId = 8453;
    if (data.txHash) withdrawal.txHash = data.txHash;
    withdrawal.paymentConfirmation = { ...data, actor, amountMicros: withdrawal.amountMicros.toString(), address: withdrawal.address };
    await withdrawal.save({ session });
    await ledger(session, account, 'withdrawal_paid', `paid:${id}`, withdrawal._id, withdrawal.amountMicros);
    const amount = `${withdrawal.amountMicros / 1_000_000n}.${(withdrawal.amountMicros % 1_000_000n).toString().padStart(6, '0')}`.replace(/\.?0+$/, '');
    await notice(session, withdrawal.playerId, 'withdrawal', withdrawal._id,
      `The administrator marked your ${amount} USDC withdrawal as paid to ${withdrawal.address} on Base. Open your Base wallet to confirm receipt.`);
    await audit(session, actor, 'withdrawal_manually_paid', withdrawal._id, { ...data, amountMicros: withdrawal.amountMicros.toString(), address: withdrawal.address, paymentMethod: 'manual' });
    return withdrawal;
  });
}

/** Signing may be retried by Mongo; broadcasting MUST NEVER happen inside this transaction. */
export async function executeWithdrawal(actor, id, chain) {
  if (!chain?.enabled) fail('bounty_payouts_not_configured', 503);
  const intent = await atomic(async session => {
    const withdrawal = await BountyWithdrawal.findById(id).select('+rawTransaction').session(session);
    if (!withdrawal) fail('withdrawal_not_found', 404);
    if (['paid', 'failed'].includes(withdrawal.status)) return withdrawal;
    if (!['approved', 'prepared', 'broadcast'].includes(withdrawal.status)) fail('withdrawal_not_authorized');
    const lane = await BountyTreasuryLane.findById('base-usdc').session(session);
    if (!lane) fail('bounty_not_initialized', 503);
    if (lane.activeWithdrawalId && String(lane.activeWithdrawalId) !== id) fail('treasury_busy_reconcile_active_withdrawal');
    if (!withdrawal.rawTransaction) {
      if (withdrawal.status !== 'approved') fail('payout_intent_missing');
      lane.activeWithdrawalId = withdrawal._id; await lane.save({ session });
      const signed = await chain.prepare(withdrawal);
      Object.assign(withdrawal, signed, { status: 'prepared' });
      await withdrawal.save({ session });
      await audit(session, actor, 'payout_prepared', withdrawal._id, { txHash: signed.txHash, nonce: signed.nonce, treasury: signed.treasury });
      await notice(session, withdrawal.playerId, 'withdrawal', withdrawal._id, 'Base payout prepared. Funds remain reserved until verified final settlement.');
    } else if (String(lane.activeWithdrawalId) !== id) {
      fail('treasury_lane_mismatch');
    }
    return withdrawal;
  });
  if (['paid', 'failed'].includes(intent.status)) return intent;
  // The exact persisted bytes are safe to rebroadcast after a timeout/restart.
  // RPC errors are NOT proof of a failed transfer; leave reservation + lane intact.
  let broadcastError = false;
  try { await chain.broadcast(intent.rawTransaction, intent.txHash); }
  catch { broadcastError = true; }
  if (!broadcastError) await atomic(async session => {
    const withdrawal = await BountyWithdrawal.findOne({ _id: id, status: 'prepared' }).session(session);
    if (!withdrawal) return;
    withdrawal.status = 'broadcast'; await withdrawal.save({ session });
    await audit(session, actor, 'payout_broadcast', withdrawal._id, { txHash: withdrawal.txHash });
    await notice(session, withdrawal.playerId, 'withdrawal', withdrawal._id, 'Base payout broadcast. Awaiting finalized USDC transfer verification.');
  });
  return reconcileWithdrawal(actor, id, chain);
}
export async function reconcileWithdrawal(actor, id, chain) {
  if (!chain?.enabled) fail('bounty_payouts_not_configured', 503);
  const intent = await BountyWithdrawal.findById(id).select('+rawTransaction');
  if (!intent) fail('withdrawal_not_found', 404);
  if (['paid', 'failed'].includes(intent.status)) return intent;
  if (!intent.rawTransaction || !['prepared', 'broadcast'].includes(intent.status)) fail('payout_not_prepared');
  let outcome;
  try { outcome = await chain.inspect(intent); }
  catch { return intent; } // Unknown, RPC outage, reorg or receipt mismatch: retain funds.
  if (!['paid', 'reverted'].includes(outcome.status)) return intent;
  return atomic(async session => {
    const withdrawal = await BountyWithdrawal.findById(id).session(session);
    if (['paid', 'failed'].includes(withdrawal.status)) return withdrawal;
    if (withdrawal.txHash !== intent.txHash) fail('payout_intent_changed');
    const lane = await BountyTreasuryLane.findById('base-usdc').session(session);
    if (String(lane?.activeWithdrawalId) !== id) fail('treasury_lane_mismatch');
    const account = await accountFor(withdrawal.playerId, session);
    account.reservedMicros -= withdrawal.amountMicros;
    if (outcome.status === 'paid') {
      account.withdrawnMicros += withdrawal.amountMicros;
      withdrawal.status = 'paid'; withdrawal.paidAt = new Date();
    } else {
      account.availableMicros += withdrawal.amountMicros;
      withdrawal.status = 'failed'; withdrawal.failureReason = 'finalized_onchain_revert';
    }
    bounded(account); await account.save({ session });
    withdrawal.receiptBlock = outcome.blockNumber;
    await withdrawal.save({ session });
    await ledger(session, account, outcome.status === 'paid' ? 'withdrawal_paid' : 'withdrawal_released',
      `${outcome.status === 'paid' ? 'paid' : 'release'}:${id}`, withdrawal._id, withdrawal.amountMicros);
    lane.activeWithdrawalId = null; await lane.save({ session });
    await notice(session, withdrawal.playerId, 'withdrawal', withdrawal._id,
      outcome.status === 'paid' ? `USDC paid on Base: ${withdrawal.txHash}` : 'Base transaction finalized as reverted. Reserved USDC returned to available balance.');
    await audit(session, actor, `payout_${withdrawal.status}`, withdrawal._id, { txHash: withdrawal.txHash, blockNumber: outcome.blockNumber });
    return withdrawal;
  });
}

export function paginate(model, filter, page, projection) {
  return model.find({ ...filter, ...(page.before ? { _id: { $lt: page.before } } : {}) })
    .select(projection || '').sort({ _id: -1 }).limit(page.limit).setOptions({ useBigInt64: true }).lean();
}
export const publicSubmissionFields = '-ipHash -review.actor -review.notes -review.acknowledgeRisk -riskFlags';
export const publicWithdrawalFields = '-review.actor -review.notes -review.acknowledgeRisk -riskFlags -treasury -nonce -paymentConfirmation';
export async function wallet(playerId) {
  const account = await BountyAccount.findOne({ playerId }).setOptions({ useBigInt64: true }).lean();
  return account || { availableMicros: 0n, reservedMicros: 0n, pendingMicros: 0n, earnedMicros: 0n, withdrawnMicros: 0n, address: '', notificationsReadAt: new Date(0) };
}
