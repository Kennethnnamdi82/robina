import { startPeriodicWorker } from './periodicWorker.js';
import { User } from '../models/User.js';
import { CLAIM_COOLDOWN_MS, getLevel } from '../config/levels.js';

const RUN_EVERY_MS = 60 * 1000;

export async function runAutoClaimOnce() {
  const now = new Date();
  const eligible = await User.find({
    autoClaimActive: true,
    autoClaimExpiry: { $gt: now },
    $or: [
      { lastClaimTime: { $lte: new Date(now.getTime() - CLAIM_COOLDOWN_MS) } },
      { lastClaimTime: null },
      { lastClaimTime: { $exists: false } },
    ],
  }).select('wallet level');

  await Promise.all(eligible.map((user) => User.updateOne(
    {
      wallet: user.wallet,
      autoClaimActive: true,
      autoClaimExpiry: { $gt: now },
      $or: [
        { lastClaimTime: { $lte: new Date(now.getTime() - CLAIM_COOLDOWN_MS) } },
        { lastClaimTime: null },
        { lastClaimTime: { $exists: false } },
      ],
    },
    { $inc: { bdBalance: getLevel(user.level).claimReward }, $set: { lastClaimTime: now } }
  )));

  await User.updateMany(
    { autoClaimActive: true, autoClaimExpiry: { $lte: now } },
    { $set: { autoClaimActive: false } }
  );
}

export function startAutoClaimWorker() {
  return startPeriodicWorker(runAutoClaimOnce, RUN_EVERY_MS, error => console.error('[auto-claim]', error));
}
