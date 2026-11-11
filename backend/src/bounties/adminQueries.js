import mongoose from 'mongoose';
import { z } from 'zod';
import { BountyTask, BountySubmission, BountyWithdrawal, BountyAccount, BountyLedger } from './models.js';
import { pageInput, parse, fail } from './validation.js';
import { atomic, wallet } from './service.js';
import { User } from '../models/User.js';

export const activeTaskFilter = (now = new Date()) => ({ status: 'active', $and: [
  { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
  { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
] });
export const adminListInput = pageInput.extend({ q: z.string().trim().max(80).default(''), status: z.string().max(20).default('all') }).strict();
const literal = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const profileLookup = [
  { $lookup: { from: User.collection.name, localField: 'playerId', foreignField: '_id',
    pipeline: [{ $project: { wallet: 1, walletAddress: 1, email: 1, accountStatus: 1 } }], as: 'player' } },
  { $unwind: { path: '$player', preserveNullAndEmptyArrays: true } },
];
function pageResult(items, limit) { return { items, nextBefore: items.length === limit ? String(items.at(-1)._id) : null }; }
const moneyProjections = model => Object.fromEntries((model === BountyTask ? ['terms.rewardMicros', 'budgetMicros', 'committedMicros', 'rewardedMicros']
  : model === BountySubmission ? ['terms.rewardMicros'] : model === BountyWithdrawal ? ['amountMicros']
    : ['availableMicros', 'reservedMicros', 'pendingMicros', 'earnedMicros', 'withdrawnMicros']).map(key => [key, { $toString: `$${key}` }]));

export async function adminList(model, query) {
  const page = parse(adminListInput, query);
  const allowed = model === BountyTask ? ['draft', 'active', 'paused', 'closed'] : model === BountySubmission ? ['pending', 'approved', 'rejected']
    : model === BountyWithdrawal ? ['pending', 'approved', 'prepared', 'broadcast', 'paid', 'rejected', 'failed'] : ['flagged'];
  if (page.status !== 'all' && !allowed.includes(page.status)) fail('invalid_request', 400);
  const pipeline = [{ $match: { ...(page.before ? { _id: { $lt: new mongoose.Types.ObjectId(page.before) } } : {}),
    ...(model !== BountyAccount && page.status !== 'all' ? { status: page.status } : {}) } }];
  if (model !== BountyTask) pipeline.push(...profileLookup);
  if (model === BountyAccount) {
    pipeline.push({ $lookup: { from: BountySubmission.collection.name, let: { playerId: '$playerId' }, pipeline: [
      { $match: { $expr: { $eq: ['$playerId', '$$playerId'] } } },
      { $project: { status: 1, riskFlags: 1 } },
    ], as: 'participation' } });
    pipeline.push({ $lookup: { from: BountyWithdrawal.collection.name, let: { playerId: '$playerId' }, pipeline: [
      { $match: { $expr: { $eq: ['$playerId', '$$playerId'] }, 'riskFlags.0': { $exists: true } } }, { $project: { riskFlags: 1 } },
    ], as: 'withdrawalRisks' } });
    pipeline.push({ $set: {
      approvedTasks: { $size: { $filter: { input: '$participation', as: 's', cond: { $eq: ['$$s.status', 'approved'] } } } },
      riskFlags: { $reduce: { input: { $concatArrays: ['$participation', '$withdrawalRisks'] }, initialValue: [], in: { $setUnion: ['$$value', '$$this.riskFlags'] } } },
    } });
    if (page.status === 'flagged') pipeline.push({ $match: { 'riskFlags.0': { $exists: true } } });
    pipeline.push({ $project: { participation: 0, withdrawalRisks: 0 } });
  }
  if (page.q) {
    const fields = model === BountyTask ? ['terms.title', 'terms.platform'] : ['player.wallet', 'player.walletAddress', 'player.email', 'postUrl', 'terms.title', 'address', 'txHash'];
    const matches = fields.map(field => ({ [field]: { $regex: literal(page.q), $options: 'i' } }));
    if (/^[a-f\d]{24}$/i.test(page.q)) matches.push({ playerId: new mongoose.Types.ObjectId(page.q) });
    pipeline.push({ $match: { $or: matches } });
  }
  pipeline.push({ $sort: { _id: -1 } }, { $limit: page.limit }, { $set: moneyProjections(model) }, { $project: { rawTransaction: 0, ipHash: 0 } });
  const items = await model.aggregate(pipeline).option({ maxTimeMS: 5000 });
  if ([BountySubmission, BountyWithdrawal].includes(model)) {
    const accounts = await BountyAccount.find({ playerId: { $in: items.map(item => item.playerId) } }).setOptions({ useBigInt64: true }).lean();
    const byPlayer = new Map(accounts.map(account => [String(account.playerId), account]));
    for (const item of items) item.wallet = byPlayer.get(String(item.playerId)) || null;
  }
  return pageResult(items, page.limit);
}
export async function adminSummary(payoutsEnabled) {
  return atomic(async session => {
    const activeBounties = await BountyTask.countDocuments(activeTaskFilter()).session(session);
    const taskCounts = await BountyTask.countDocuments().session(session);
    const counts = await BountySubmission.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).session(session);
    const withdrawals = await BountyWithdrawal.countDocuments({ status: { $in: ['pending', 'approved', 'prepared', 'broadcast'] } }).session(session);
    // Exact decimal intermediates prevent Mongo from promoting overflowing Int64
    // sums to floating point when combining many individually bounded accounts.
    const [totals] = await BountyAccount.aggregate([{ $group: { _id: null, earned: { $sum: { $toDecimal: '$earnedMicros' } }, available: { $sum: { $toDecimal: '$availableMicros' } }, reserved: { $sum: { $toDecimal: '$reservedMicros' } }, withdrawn: { $sum: { $toDecimal: '$withdrawnMicros' } } } },
      { $project: { _id: 0, rewardsIssuedMicros: { $toString: '$earned' }, availableMicros: { $toString: '$available' },
        outstandingMicros: { $toString: { $add: ['$available', '$reserved'] } }, reservedMicros: { $toString: '$reserved' }, withdrawnMicros: { $toString: '$withdrawn' } } }]).session(session);
    const byStatus = Object.fromEntries(counts.map(item => [item._id, item.count]));
    return { activeBounties, totalBounties: taskCounts, totalSubmissions: counts.reduce((sum, item) => sum + item.count, 0),
      pendingApprovals: byStatus.pending || 0, approvedSubmissions: byStatus.approved || 0, pendingWithdrawals: withdrawals,
      payoutsEnabled, ...(totals || { rewardsIssuedMicros: '0', availableMicros: '0', outstandingMicros: '0', reservedMicros: '0', withdrawnMicros: '0' }) };
  });
}
export async function adminPlayer(id) {
  const player = await User.findById(id).select('wallet walletAddress email accountStatus').lean();
  if (!player) fail('player_not_found', 404);
  const approvedTasks = await BountySubmission.countDocuments({ playerId: id, status: 'approved' });
  const flagged = await BountySubmission.find({ playerId: id, 'riskFlags.0': { $exists: true } }).select('riskFlags').lean();
  const withdrawals = await BountyWithdrawal.find({ playerId: id, 'riskFlags.0': { $exists: true } }).select('riskFlags').lean();
  return { player, wallet: await wallet(id), approvedTasks, riskFlags: [...new Set([...flagged, ...withdrawals].flatMap(item => item.riskFlags))] };
}
export const playerHistoryModels = { submissions: BountySubmission, withdrawals: BountyWithdrawal, ledger: BountyLedger };
