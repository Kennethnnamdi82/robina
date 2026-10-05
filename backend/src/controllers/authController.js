import { SiweMessage, generateNonce } from "siwe";
import { ethers } from "ethers";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { RevokedToken } from "../models/RevokedToken.js";
import { env } from "../config/env.js";
import {
  signSession,
  setSessionCookie,
  clearSessionCookie,
} from "../middleware/auth.js";
import { generateReferralCode } from "../utils/referral.js";
import { logActivity, logLoginSession } from "../services/activityLogger.js";

const NONCE_TTL_MS = 10 * 60 * 1000;
const SIWE_MAX_AGE_MS = 15 * 60 * 1000;

const verifyBody = z.object({
  message: z.string().min(10),
  signature: z.string().min(10),
  ref: z.string().optional(),
});

function safeOrigin(value) {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function publicUser(u) {
  return {
    wallet: u.wallet,
    bdBalance: u.bdBalance,
    level: u.level,
    cardMultiplier: Number(u.cardMultiplier || 1),
    role: u.role || "user",
    lastClaimTime: u.lastClaimTime,
    autoClaimActive: u.autoClaimActive,
    autoClaimExpiry: u.autoClaimExpiry,
    referralCode: u.referralCode,
    referralCount: u.referralCount,
    completedTasks: u.completedTasks || [],
    lastDailyTaskDate: u.lastDailyTaskDate,
  };
}

export async function getNonce(req, res) {
  const wallet = String(req.query.wallet || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
    return res.status(400).json({ error: "invalid_wallet" });
  }

  const nonce = generateNonce();
  await User.findOneAndUpdate(
    { wallet },
    {
      $set: { nonce, nonceIssuedAt: new Date() },
      $setOnInsert: {
        referralCode: generateReferralCode(wallet),
        bdBalance: 0,
        level: "Beginner",
      },
    },
    { upsert: true, new: true },
  );
  res.json({ nonce });
}

export async function verifySiwe(req, res) {
  const parsed = verifyBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body" });
  }
  const { message, signature, ref } = parsed.data;

  let siwe;
  try {
    siwe = new SiweMessage(message);
  } catch {
    return res.status(400).json({ error: "invalid_message" });
  }

  // SIWE Validations... (Keeping your existing logic)
  if (siwe.chainId !== env.chainId)
    return res.status(400).json({ error: "wrong_chain" });

  const wallet = siwe.address.toLowerCase();
  const user = await User.findOne({ wallet });
  if (!user || user.nonce !== siwe.nonce)
    return res.status(400).json({ error: "nonce_mismatch" });
  const isNewRegistration =
    user.createdAt && Date.now() - new Date(user.createdAt).getTime() <= SIWE_MAX_AGE_MS;
  let referredByWallet = null;

  try {
    const provider = new ethers.JsonRpcProvider(env.baseRpcUrl);
    const result = await siwe.verify(
      { signature, nonce: user.nonce, domain: env.siweDomain },
      { provider },
    );
    if (!result.success)
      return res.status(401).json({ error: "signature_invalid" });
  } catch (e) {
    return res.status(401).json({ error: "signature_invalid" });
  }

  // Handle Referrals
  if (ref && !user.referredBy) {
    const inviter = await User.findOne({ referralCode: ref });
    if (inviter && inviter.wallet !== wallet) {
      user.referredBy = inviter.wallet;
      referredByWallet = inviter.wallet;
      inviter.referralCount += 1;
      await inviter.save();
    }
  }

  user.nonce = null;
  await user.save();

  const token = signSession(wallet, Number(user.sessionVersion || 0));

  // ✅ Setting cookies with updated SameSite/Secure flags happens inside setSessionCookie
  setSessionCookie(res, token);

  void logLoginSession(req, wallet, { registration: isNewRegistration });
  void logActivity({
    wallet,
    activityType: "user_login",
    activityDetails: "User signed in with wallet",
    module: "auth",
    status: "success",
  });
  if (isNewRegistration) {
    void logActivity({
      wallet,
      activityType: "user_registration",
      activityDetails: "New wallet account registered",
      module: "auth",
      status: "success",
      metadata: { referredBy: referredByWallet },
    });
  }
  if (referredByWallet) {
    void logActivity({
      wallet,
      activityType: "referral_registration",
      activityDetails: `Registered with referral from ${referredByWallet}`,
      module: "referrals",
      status: "success",
      metadata: { referredBy: referredByWallet },
    });
  }

  res.json({ ok: true, user: publicUser(user), token });
}

export async function logout(req, res) {
  const authHeader = String(req.headers.authorization || "");
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const token = req.cookies?.bd_session || bearerToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, env.jwtSecret, {
        issuer: "basedrop",
        audience: "basedrop-users",
      });
      if (decoded?.jti) {
        const expiresAt = decoded.exp
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + 7 * 24 * 3600000);
        await RevokedToken.updateOne(
          { jti: decoded.jti },
          { $setOnInsert: { kind: "user", expiresAt } },
          { upsert: true },
        );
      }
    } catch {
      // no-op: always clear cookie below
    }
  }
  clearSessionCookie(res);
  res.json({ ok: true });
}

export async function me(req, res) {
  const user = await User.findOne({ wallet: req.wallet });
  if (!user) return res.status(401).json({ error: "unauthenticated" });

  res.json({ user: publicUser(user), token: req.authToken || null });
}
