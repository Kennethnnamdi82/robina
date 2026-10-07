import { SiweMessage } from "siwe";
import { z } from "zod";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PrivyClient } from "@privy-io/node";
import { User } from "../models/User.js";
import { AuthNonce } from "../models/AuthNonce.js";
import { RevokedToken } from "../models/RevokedToken.js";
import { getVerifiedGoogleAccount } from "../services/authIdentity.js";
import { env } from "../config/env.js";
import {
  signSession,
  setSessionCookie,
  clearSessionCookie,
} from "../middleware/auth.js";
import { generateReferralCode } from "../utils/referral.js";
import { logActivity, logLoginSession } from "../services/activityLogger.js";

const SIWE_MAX_AGE_MS = 15 * 60 * 1000;

const verifyBody = z.object({
  message: z.string().min(10),
  signature: z.string().min(10),
  ref: z.string().optional(),
});

const nonceQuery = z.object({
  wallet: z.string().optional(),
  address: z.string().optional(),
  chainType: z.enum(["evm", "solana"]).default("evm"),
  chainId: z.string().regex(/^\d+$/).optional(),
});
const walletAuthBody = z.object({
  message: z.string().min(10).max(10_000),
  signature: z.string().min(10).max(1_000),
  address: z.string().min(20).max(128),
  chainType: z.enum(["evm", "solana"]),
  chainId: z.string().max(80).optional(),
  ref: z.string().max(64).optional(),
});
const googleAuthBody = z.object({
  accessToken: z.string().min(20).max(16_384),
  ref: z.string().max(64).optional(),
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
    wallet: u.walletAddress || u.wallet,
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
    email: u.email || null,
    authMethod: u.authMethod || "wallet_evm",
    chainType: u.chainType || "evm",
  };
}

function normalizedAddress(address, chainType) {
  const value = String(address || "").trim();
  if (chainType === "evm") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
    return value.toLowerCase();
  }
  try {
    if (bs58.decode(value).length !== 32) return null;
    return value;
  } catch {
    return null;
  }
}

function makeNonce() {
  // 32 cryptographically random bytes, encoded without punctuation so it is
  // accepted by the SIWE nonce grammar.
  return crypto.randomBytes(32).toString("base64url");
}

async function resolveWalletUser(wallet, chainType) {
  const walletIdentity = chainType === "solana"
    ? `solana:${Buffer.from(bs58.decode(wallet)).toString("hex")}`
    : wallet;
  return User.findOneAndUpdate(
    { wallet: walletIdentity },
    {
      $setOnInsert: {
        wallet: walletIdentity,
        walletAddress: chainType === "solana" ? wallet : null,
        authMethod: chainType === "solana" ? "wallet_solana" : "wallet_evm",
        chainType,
        referralCode: generateReferralCode(wallet),
        bdBalance: 0,
        level: "Beginner",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function siwsMessage({ address, nonce, issuedAt, expirationTime }) {
  return `${env.siweDomain} wants you to sign in with your Solana account:\n${address}\n\nSign in to Robina.\n\nURI: ${env.siweUri}\nVersion: 1\nChain ID: solana:mainnet\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;
}

function parseSiwsMessage(message) {
  const fields = Object.fromEntries(
    message.split("\n").map((line) => {
      const separator = line.indexOf(": ");
      return separator > 0 ? [line.slice(0, separator), line.slice(separator + 2)] : [];
    }).filter((entry) => entry.length),
  );
  const lines = message.split("\n");
  const address = lines[1];
  const expectedPrefix = `${env.siweDomain} wants you to sign in with your Solana account:`;
  if (lines[0] !== expectedPrefix || lines[3] !== "Sign in to Robina.") return null;
  if (fields.URI !== env.siweUri || fields.Version !== "1" || fields["Chain ID"] !== "solana:mainnet") return null;
  return { address, nonce: fields.Nonce, issuedAt: fields["Issued At"], expirationTime: fields["Expiration Time"] };
}

export async function getNonce(req, res) {
  const parsed = nonceQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_nonce_request" });
  const chainType = parsed.data.chainType;
  const wallet = normalizedAddress(parsed.data.address || parsed.data.wallet, chainType);
  if (!wallet) {
    return res.status(400).json({ error: "invalid_wallet" });
  }
  const nonce = makeNonce();
  const expiresAt = new Date(Date.now() + env.authNonceTtlMs);
  const chainId = chainType === "evm" ? String(parsed.data.chainId || env.chainId) : "solana:mainnet";
  if (chainType === "evm" && !env.evmChains[chainId]) {
    return res.status(400).json({ error: "unsupported_chain" });
  }
  await AuthNonce.create({
    nonce,
    address: wallet,
    chainType,
    chainId,
    domain: env.siweDomain,
    uri: env.siweUri,
    expiresAt,
  });
  res.json({ nonce, chainType, chainId, expiresAt: expiresAt.toISOString() });
}

export async function walletLogin(req, res) {
  const parsed = walletAuthBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body" });
  }
  const { message, signature, chainType, ref } = parsed.data;
  const wallet = normalizedAddress(parsed.data.address, chainType);
  if (!wallet) return res.status(400).json({ error: "invalid_wallet" });

  let nonce;
  try {
    if (chainType === "evm") {
      const siwe = new SiweMessage(message);
      if (
        siwe.domain !== env.siweDomain ||
        siwe.uri !== env.siweUri ||
        !env.evmChains[String(siwe.chainId)] ||
        siwe.chainId !== Number(parsed.data.chainId || env.chainId) ||
        normalizedAddress(siwe.address, "evm") !== wallet ||
        !siwe.issuedAt || !siwe.expirationTime
      ) return res.status(400).json({ error: "invalid_message" });
      const issuedAt = new Date(siwe.issuedAt).getTime();
      const expirationTime = new Date(siwe.expirationTime).getTime();
      if (
        !Number.isFinite(issuedAt) ||
        !Number.isFinite(expirationTime) ||
        issuedAt > Date.now() + 60_000 ||
        issuedAt < Date.now() - SIWE_MAX_AGE_MS ||
        expirationTime <= Date.now()
      ) {
        return res.status(400).json({ error: "message_expired" });
      }
      nonce = siwe.nonce;
      const challenge = await AuthNonce.findOne({
        nonce,
        address: wallet,
        chainType,
        chainId: String(siwe.chainId),
        domain: env.siweDomain,
        uri: env.siweUri,
        usedAt: null,
      });
      if (!challenge || challenge.expiresAt <= new Date()) return res.status(400).json({ error: "nonce_expired_or_used" });
      const verified = await siwe.verify({ signature, nonce, domain: env.siweDomain, time: new Date().toISOString() });
      if (!verified.success) return res.status(401).json({ error: "signature_invalid" });
    } else {
      const parsedMessage = parseSiwsMessage(message);
      if (!parsedMessage || parsedMessage.address !== wallet || !parsedMessage.nonce || !parsedMessage.issuedAt || !parsedMessage.expirationTime) {
        return res.status(400).json({ error: "invalid_message" });
      }
      const issuedAt = new Date(parsedMessage.issuedAt).getTime();
      const expirationTime = new Date(parsedMessage.expirationTime).getTime();
      if (
        !Number.isFinite(issuedAt) ||
        !Number.isFinite(expirationTime) ||
        issuedAt > Date.now() + 60_000 ||
        issuedAt < Date.now() - SIWE_MAX_AGE_MS ||
        expirationTime <= Date.now()
      ) {
        return res.status(400).json({ error: "message_expired" });
      }
      nonce = parsedMessage.nonce;
      const challenge = await AuthNonce.findOne({
        nonce,
        address: wallet,
        chainType,
        chainId: "solana:mainnet",
        domain: env.siweDomain,
        uri: env.siweUri,
        usedAt: null,
      });
      if (!challenge || challenge.expiresAt <= new Date()) return res.status(400).json({ error: "nonce_expired_or_used" });
      if (!nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(signature), bs58.decode(wallet))) {
        return res.status(401).json({ error: "signature_invalid" });
      }
    }
  } catch {
    return res.status(401).json({ error: "signature_invalid" });
  }

  // Atomic consumption is the replay barrier. A second concurrent request sees
  // no matching unused challenge and cannot receive a second session.
  const consumed = await AuthNonce.findOneAndUpdate(
    { nonce, address: wallet, chainType, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!consumed) return res.status(400).json({ error: "nonce_expired_or_used" });

  const user = await resolveWalletUser(wallet, chainType);
  const isNewRegistration =
    user.createdAt && Date.now() - new Date(user.createdAt).getTime() <= SIWE_MAX_AGE_MS;
  let referredByWallet = null;

  // Handle Referrals
  if (ref && !user.referredBy) {
    const inviter = await User.findOne({ referralCode: ref });
    if (inviter && inviter.wallet !== user.wallet) {
      user.referredBy = inviter.wallet;
      referredByWallet = inviter.wallet;
      inviter.referralCount += 1;
      await inviter.save();
    }
  }

  const token = signSession(user.wallet, Number(user.sessionVersion || 0));

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

  res.json({ ok: true, user: publicUser(user) });
}

// Compatibility route used by the existing client. It is deliberately routed
// through the same strict one-time nonce verifier as /auth/wallet.
export async function verifySiwe(req, res) {
  let siwe;
  try {
    siwe = new SiweMessage(req.body?.message || "");
  } catch {
    return res.status(400).json({ error: "invalid_message" });
  }
  req.body = { ...req.body, address: siwe.address, chainType: "evm", chainId: String(siwe.chainId) };
  return walletLogin(req, res);
}

export async function googleLogin(req, res) {
  const parsed = googleAuthBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });
  if (!env.privyAppId || !env.privyAppSecret || !env.privyVerificationKey) {
    return res.status(503).json({ error: "privy_not_configured" });
  }

  const client = new PrivyClient({ appId: env.privyAppId, appSecret: env.privyAppSecret, jwtVerificationKey: env.privyVerificationKey || undefined });
  let verified;
  try {
    verified = await client.utils().auth().verifyAccessToken(parsed.data.accessToken);
  } catch {
    return res.status(401).json({ error: "privy_token_invalid" });
  }
  if (verified.app_id !== env.privyAppId) {
    return res.status(401).json({ error: "privy_token_invalid" });
  }

  let privyUser;
  try {
    privyUser = await client.users._get(verified.user_id);
  } catch (error) {
    return res.status(error?.status === 404 ? 401 : 503).json({
      error: error?.status === 404 ? "privy_token_invalid" : "privy_unavailable",
    });
  }

  const googleAccount = getVerifiedGoogleAccount(privyUser);
  if (!googleAccount) {
    return res.status(403).json({ error: "google_account_required" });
  }

  const wallet = `privy:${verified.user_id}`.toLowerCase();
  let user;
  try {
    user = await User.findOneAndUpdate(
      { privyUserId: verified.user_id },
      {
        $set: {
          email: googleAccount.email,
          authMethod: "privy_google",
          chainType: "none",
        },
        $setOnInsert: {
          wallet,
          privyUserId: verified.user_id,
          referralCode: generateReferralCode(wallet),
          bdBalance: 0,
          level: "Beginner",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    user = await User.findOne({
      $or: [{ privyUserId: verified.user_id }, { wallet }],
    });
    if (!user) throw error;
    if (user.privyUserId && user.privyUserId !== verified.user_id) throw error;
    user.email = googleAccount.email;
    user.authMethod = "privy_google";
    user.chainType = "none";
    user.privyUserId = verified.user_id;
    await user.save();
  }

  if (parsed.data.ref && !user.referredBy) {
    const inviter = await User.findOne({ referralCode: parsed.data.ref });
    if (inviter && inviter.wallet !== user.wallet) {
      user.referredBy = inviter.wallet;
      inviter.referralCount += 1;
      await Promise.all([user.save(), inviter.save()]);
    }
  }

  const token = signSession(user.wallet, Number(user.sessionVersion || 0));
  setSessionCookie(res, token);
  void logLoginSession(req, user.wallet, { registration: false });
  void logActivity({
    wallet: user.wallet,
    activityType: "user_login",
    activityDetails: "User signed in with Google",
    module: "auth",
    status: "success",
  });
  return res.json({ ok: true, user: publicUser(user) });
}

export async function logout(req, res) {
  const token = req.cookies?.bd_session;
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

  res.json({ user: publicUser(user) });
}
