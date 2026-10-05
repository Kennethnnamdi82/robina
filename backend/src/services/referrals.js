import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { REFERRAL_REWARD } from '../config/levels.js';

export async function settleReferralReward(wallet) {
  const normalizedWallet = wallet.toLowerCase();
  const hasVerifiedPaidAction = await Payment.exists({ wallet: normalizedWallet, status: 'verified' });
  if (!hasVerifiedPaidAction) return null;

  const updated = await User.findOneAndUpdate(
    {
      wallet: normalizedWallet,
      referredBy: { $type: 'string', $ne: '' },
      referralRewardEligible: false,
      'completedTasks.0': { $exists: true },
    },
    {
      $set: { referralRewardEligible: true },
      $inc: { bdBalance: REFERRAL_REWARD },
    },
    { new: true }
  );

  if (!updated?.referredBy) return null;
  await User.updateOne(
    { wallet: updated.referredBy },
    { $inc: { bdBalance: REFERRAL_REWARD } }
  );
  return updated;
}
