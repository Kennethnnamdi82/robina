import { User } from "../models/User.js";
import { CLAIM_COOLDOWN_MS, getLevel } from "../config/levels.js";
import { logActivity } from "../services/activityLogger.js";

export async function claim(req, res) {
  const user = await User.findOne({ wallet: req.wallet });
  if (!user) return res.status(404).json({ error: "not_found" });

  const now = new Date();

  // Safely handle null/missing lastClaimTime for new users
  const lastTime = user.lastClaimTime
    ? new Date(user.lastClaimTime).getTime()
    : 0;
  const safeLastTime = Math.min(lastTime, now.getTime());
  const elapsed = now.getTime() - safeLastTime;

  if (elapsed < CLAIM_COOLDOWN_MS) {
    return res.status(429).json({
      error: "cooldown",
      remainingMs: CLAIM_COOLDOWN_MS - elapsed,
    });
  }

  const reward = getLevel(user.level).claimReward;

  // ATOMIC UPDATE: Allows claim if 6h passed OR if lastClaimTime is null/missing
  const updated = await User.findOneAndUpdate(
    {
      wallet: req.wallet,
      $or: [
        {
          lastClaimTime: { $lte: new Date(now.getTime() - CLAIM_COOLDOWN_MS) },
        },
        { lastClaimTime: null },
        { lastClaimTime: { $exists: false } },
      ],
    },
    {
      $inc: { bdBalance: reward },
      $set: { lastClaimTime: now },
    },
    { new: true },
  );

  if (!updated) {
    return res
      .status(429)
      .json({ error: "cooldown", remainingMs: CLAIM_COOLDOWN_MS });
  }

  void logActivity({
    wallet: req.wallet,
    activityType: "bd_claim",
    activityDetails: `Claimed ${reward} BD`,
    module: "mining",
    status: "success",
    bdAmount: reward,
    metadata: { level: updated.level },
  });

  res.json({
    ok: true,
    reward,
    bdBalance: updated.bdBalance,
    lastClaimTime: updated.lastClaimTime,
    nextClaimMs: CLAIM_COOLDOWN_MS,
  });
}

export async function status(req, res) {
  const user = await User.findOne({ wallet: req.wallet });
  if (!user) return res.status(404).json({ error: "not_found" });

  const lastTime = user.lastClaimTime
    ? new Date(user.lastClaimTime).getTime()
    : 0;
  const nowMs = Date.now();
  const safeLastTime = Math.min(lastTime, nowMs);
  const elapsed = nowMs - safeLastTime;

  const autoActive = Boolean(
    user.autoClaimActive &&
    user.autoClaimExpiry &&
    new Date(user.autoClaimExpiry).getTime() > nowMs,
  );
  const cooldownRemainingMs = Math.max(0, CLAIM_COOLDOWN_MS - elapsed);
  const canClaim = cooldownRemainingMs === 0;
  const nextClaimAt = canClaim
    ? new Date(nowMs)
    : new Date(safeLastTime + CLAIM_COOLDOWN_MS);

  res.json({
    canClaim,
    cooldownRemainingMs,
    reward: getLevel(user.level).claimReward,
    bdBalance: user.bdBalance,
    lastClaimTime: user.lastClaimTime,
    nextClaimAt,
    now: new Date(nowMs),
    autoClaimActive: autoActive,
    autoClaimExpiry: user.autoClaimExpiry,
  });
}
