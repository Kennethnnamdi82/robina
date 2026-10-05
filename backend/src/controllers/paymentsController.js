import { z } from "zod";
import { User } from "../models/User.js";
import { Payment } from "../models/Payment.js";
import { env } from "../config/env.js";
import {
  getLevel,
  getNextLevel,
  AUTO_CLAIM_PRICE_USDC,
  AUTO_CLAIM_DURATION_MS,
} from "../config/levels.js";
import {
  cardMultiplierPriceUsdc,
  effectiveCardMultiplier,
  normalizeCardMultiplier,
} from "../config/cardMultipliers.js";
import { verifyUsdcTransfer } from "../services/baseChain.js";
import { settleReferralReward } from "../services/referrals.js";
import { logActivity } from "../services/activityLogger.js";

const verifySchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  action: z.enum(["upgrade", "instant_claim", "auto_claim", "multiplier"]),
  targetMultiplier: z.number().int().min(2).max(100).optional(),
});

function paymentActivityType(action) {
  if (action === "upgrade") return "level_upgrade";
  if (action === "auto_claim") return "auto_claim_purchase";
  if (action === "instant_claim") return "instant_claim_purchase";
  if (action === "multiplier") return "multiplier_purchase";
  return "payment_completed";
}

function logPaymentFailure({ wallet, txHash, action, reason, amountUsdc = 0 }) {
  void logActivity({
    wallet,
    activityType: "payment_failed",
    activityDetails: reason || "Payment verification failed",
    module: "payments",
    status: "failed",
    amountUsdc,
    txHash,
    metadata: { action, reason },
  });
}

export async function quote(req, res) {
  const action = String(req.query.action || "");
  const user = await User.findOne({ wallet: req.wallet });
  if (!user) return res.status(404).json({ error: "not_found" });

  if (action === "upgrade") {
    const next = getNextLevel(user.level);
    if (!next) return res.status(400).json({ error: "max_level" });
    return res.json({
      action,
      amountUsdc: next.usdcPrice,
      to: env.treasuryWallet,
      usdcContract: env.usdcContract,
      chainId: env.chainId,
      targetLevel: next.name,
    });
  }
  if (action === "instant_claim") {
    return res.json({
      action,
      amountUsdc: getLevel(user.level).instantClaimCost,
      to: env.treasuryWallet,
      usdcContract: env.usdcContract,
      chainId: env.chainId,
    });
  }
  if (action === "auto_claim") {
    return res.json({
      action,
      amountUsdc: AUTO_CLAIM_PRICE_USDC,
      to: env.treasuryWallet,
      usdcContract: env.usdcContract,
      chainId: env.chainId,
      durationMs: AUTO_CLAIM_DURATION_MS,
    });
  }
  if (action === "multiplier") {
    const targetMultiplier = normalizeCardMultiplier(req.query.multiplier);
    if (!targetMultiplier) return res.status(400).json({ error: "invalid_multiplier" });
    if (targetMultiplier <= effectiveCardMultiplier(user)) {
      return res.status(400).json({ error: "multiplier_not_upgrade" });
    }
    const amountUsdc = cardMultiplierPriceUsdc(targetMultiplier);
    if (!amountUsdc) return res.status(400).json({ error: "invalid_multiplier_price" });
    return res.json({
      action,
      amountUsdc,
      to: env.treasuryWallet,
      usdcContract: env.usdcContract,
      chainId: env.chainId,
      targetMultiplier,
    });
  }
  return res.status(400).json({ error: "invalid_action" });
}

export async function verifyPayment(req, res) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });

  const { txHash, action } = parsed.data;
  const targetMultiplier =
    action === "multiplier" ? normalizeCardMultiplier(parsed.data.targetMultiplier) : null;
  if (action === "multiplier" && !targetMultiplier) {
    return res.status(400).json({ error: "invalid_multiplier" });
  }
  const normalizedTx = txHash.toLowerCase();

  let payment = await Payment.findOne({ txHash: normalizedTx });

  // ✅ FIX: Improved logic for existing payments
  if (payment) {
    // Security: Ensure this hash isn't being claimed by a different wallet or for a different action
    if (
      payment.wallet.toLowerCase() !== req.wallet.toLowerCase() ||
      payment.action !== action ||
      (action === "multiplier" &&
        Number(payment.targetMultiplier || 0) !== Number(targetMultiplier))
    ) {
      return res.status(409).json({ error: "tx_already_used" });
    }

    // If already verified, return success immediately
    if (payment.status === "verified") {
      const verifiedUser = await User.findOne({ wallet: req.wallet });
      if (!verifiedUser) return res.status(404).json({ error: "not_found" });
      return res.json({
        ok: true,
        action,
        user: {
          wallet: verifiedUser.wallet,
          bdBalance: verifiedUser.bdBalance,
          level: verifiedUser.level,
          cardMultiplier: Number(verifiedUser.cardMultiplier || 1),
          autoClaimActive: verifiedUser.autoClaimActive,
          autoClaimExpiry: verifiedUser.autoClaimExpiry,
        },
      });
    }
    if (payment.status === "processing") {
      return res.status(409).json({ error: "verification_in_progress" });
    }

    // ✅ THE FIX: If the status is 'failed' or 'pending', we RESET it and try verifying again.
    // This stops the "tx already used" error from blocking a retry.
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: "pending", failureReason: null } },
    );
    payment.status = "pending";
    payment.failureReason = null;
  } else {
    // Create new record if first time seeing this hash
    try {
      payment = await Payment.create({
        txHash: normalizedTx,
        wallet: req.wallet,
        action,
        targetMultiplier,
        amountUsdc: 0,
        status: "pending",
      });
    } catch (e) {
      if (e?.code === 11000)
        return res.status(409).json({ error: "tx_already_used" });
      throw e;
    }
  }

  const user = await User.findOne({ wallet: req.wallet });
  if (!user) {
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: "failed", failureReason: "user_not_found" } },
    );
    logPaymentFailure({ wallet: req.wallet, txHash: normalizedTx, action, reason: "user_not_found" });
    return res.status(404).json({ error: "not_found" });
  }

  let requiredAmount = 0;
  let targetLevel = null;

  if (action === "upgrade") {
    const next = getNextLevel(user.level);
    if (!next) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { status: "failed", failureReason: "max_level" } },
      );
      logPaymentFailure({ wallet: req.wallet, txHash: normalizedTx, action, reason: "max_level" });
      return res.status(400).json({ error: "max_level" });
    }
    requiredAmount = next.usdcPrice;
    targetLevel = next.name;
  } else if (action === "instant_claim") {
    requiredAmount = getLevel(user.level).instantClaimCost;
  } else if (action === "auto_claim") {
    requiredAmount = AUTO_CLAIM_PRICE_USDC;
  } else if (action === "multiplier") {
    if (targetMultiplier <= effectiveCardMultiplier(user)) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { status: "failed", failureReason: "multiplier_not_upgrade" } },
      );
      return res.status(400).json({ error: "multiplier_not_upgrade" });
    }
    requiredAmount = cardMultiplierPriceUsdc(targetMultiplier);
    if (!requiredAmount) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { status: "failed", failureReason: "invalid_multiplier_price" } },
      );
      return res.status(400).json({ error: "invalid_multiplier_price" });
    }
  }

  let result;
  try {
    // Trigger on-chain verification
    result = await verifyUsdcTransfer({
      txHash,
      expectedTo: env.treasuryWallet,
      minAmount: requiredAmount,
    });

    if (result.from.toLowerCase() !== user.wallet.toLowerCase()) {
      throw Object.assign(new Error("sender_mismatch"), { status: 400 });
    }
  } catch (e) {
    const errorCode = String(
      e?.code || e?.message || "payment_verification_failed",
    );

    if (e?.code === "confirmations_pending") {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { status: "pending", failureReason: "confirmations_pending" } },
      );
      return res
        .status(409)
        .json({ error: "confirmations_pending", details: e.details });
    }

    // Mark as failed but allow future retries by the same user
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: "failed", failureReason: errorCode } },
    );
    logPaymentFailure({
      wallet: req.wallet,
      txHash: normalizedTx,
      action,
      reason: errorCode,
      amountUsdc: requiredAmount,
    });
    return res
      .status(e?.status || 400)
      .json({ error: errorCode, details: e?.details });
  }

  // Lock this tx before applying user mutations to prevent duplicate credits.
  const lock = await Payment.updateOne(
    { _id: payment._id, status: "pending" },
    {
      $set: {
        status: "processing",
        targetLevel,
        targetMultiplier,
        amountUsdc: result.amount,
        blockNumber: result.blockNumber,
        failureReason: null,
      },
    },
  );

  if (!lock.modifiedCount) {
    const latest = await Payment.findById(payment._id);
    if (latest?.status === "verified") {
      const verifiedUser = await User.findOne({ wallet: req.wallet });
      if (!verifiedUser) return res.status(404).json({ error: "not_found" });
      return res.json({
        ok: true,
        action,
        user: {
          wallet: verifiedUser.wallet,
          bdBalance: verifiedUser.bdBalance,
          level: verifiedUser.level,
          cardMultiplier: Number(verifiedUser.cardMultiplier || 1),
          autoClaimActive: verifiedUser.autoClaimActive,
          autoClaimExpiry: verifiedUser.autoClaimExpiry,
        },
      });
    }
    return res.status(409).json({ error: "verification_in_progress" });
  }

  // Handle successful verification updates (single-writer after lock).
  let update;
  if (action === "upgrade") {
    update = { $set: { level: targetLevel } };
  } else if (action === "instant_claim") {
    update = {
      $inc: { bdBalance: getLevel(user.level).claimReward },
      $set: { lastClaimTime: new Date() },
    };
  } else if (action === "auto_claim") {
    const base =
      user.autoClaimExpiry &&
      new Date(user.autoClaimExpiry).getTime() > Date.now()
        ? new Date(user.autoClaimExpiry).getTime()
        : Date.now();
    update = {
      $set: {
        autoClaimActive: true,
        autoClaimExpiry: new Date(base + AUTO_CLAIM_DURATION_MS),
      },
    };
  } else {
    update = { $max: { cardMultiplier: targetMultiplier } };
  }

  let updated;
  try {
    updated = await User.findOneAndUpdate({ wallet: req.wallet }, update, {
      new: true,
    });
    if (!updated) {
      await Payment.updateOne(
        { _id: payment._id, status: "processing" },
        { $set: { status: "failed", failureReason: "user_update_not_found" } },
      );
      logPaymentFailure({ wallet: req.wallet, txHash: normalizedTx, action, reason: "user_update_not_found", amountUsdc: result.amount });
      return res.status(404).json({ error: "not_found" });
    }
    await Payment.updateOne(
      { _id: payment._id, status: "processing" },
      {
        $set: {
          status: "verified",
        },
      },
    );
  } catch (e) {
    await Payment.updateOne(
      { _id: payment._id, status: "processing" },
      { $set: { status: "failed", failureReason: "post_verify_update_failed" } },
    );
    logPaymentFailure({ wallet: req.wallet, txHash: normalizedTx, action, reason: "post_verify_update_failed", amountUsdc: result?.amount || requiredAmount });
    throw e;
  }

  await settleReferralReward(req.wallet);

  void logActivity({
    wallet: req.wallet,
    activityType: paymentActivityType(action),
    activityDetails:
      action === "upgrade"
        ? `Upgraded to ${updated.level}`
        : action === "auto_claim"
          ? "Purchased auto claim"
          : action === "multiplier"
            ? `Purchased ${targetMultiplier}x card multiplier`
            : "Purchased instant claim",
    module: "payments",
    status: "success",
    amountUsdc: Number(result.amount || requiredAmount || 0),
    txHash: normalizedTx,
    metadata: { action, targetLevel, targetMultiplier },
  });

  res.json({
    ok: true,
    action,
    user: {
      wallet: updated.wallet,
      bdBalance: updated.bdBalance,
      level: updated.level,
      cardMultiplier: Number(updated.cardMultiplier || 1),
      autoClaimActive: updated.autoClaimActive,
      autoClaimExpiry: updated.autoClaimExpiry,
    },
  });
}

export async function upgradeWithBd(req, res) {
  const user = await User.findOne({ wallet: req.wallet });
  if (!user) return res.status(404).json({ error: "not_found" });
  const next = getNextLevel(user.level);
  if (!next) return res.status(400).json({ error: "max_level" });

  const updated = await User.findOneAndUpdate(
    {
      wallet: req.wallet,
      level: user.level,
      bdBalance: { $gte: next.bdRequired },
    },
    { $inc: { bdBalance: -next.bdRequired }, $set: { level: next.name } },
    { new: true },
  );
  if (!updated)
    return res.status(400).json({ error: "insufficient_bd_or_stale_level" });

  res.json({
    ok: true,
    user: {
      wallet: updated.wallet,
      bdBalance: updated.bdBalance,
      level: updated.level,
    },
  });
}
