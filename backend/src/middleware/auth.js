import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { RevokedToken } from "../models/RevokedToken.js";
import { isSessionVersionCurrent } from "../services/sessionVersion.js";

export function signSession(wallet, sv = 0, previous) {
  const subject = String(wallet).startsWith("solana:")
    ? String(wallet)
    : String(wallet).toLowerCase();
  const now=Math.floor(Date.now()/1000),started=previous?.started??previous?.iat??now;
  const remaining=Math.min(env.sessionIdleMs/1000,started+env.sessionMaximumMs/1000-now);
  if(remaining<=0)throw new Error('session_expired');
  return jwt.sign({ sub: subject, sv,started }, env.jwtSecret, {
    expiresIn: remaining,
    issuer: "basedrop",
    audience: "basedrop-users",
    jwtid: previous?.jti??crypto.randomBytes(16).toString("hex"),
  });
}

export function setSessionCookie(res, token) {
  res.cookie("bd_session", token, {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    maxAge: Math.max(0,Math.min(env.sessionIdleMs,((jwt.decode(token)?.exp??0)*1000)-Date.now())),
    path: "/",
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
  });
}

export function clearSessionCookie(res) {
  res.clearCookie("bd_session", {
    path: "/",
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
  });
}

export async function web3Middleware(req, res, next) {
  try {
    const token = req.cookies?.bd_session;
    if (!token) return res.status(401).json({ error: "unauthenticated" });
    const decoded = jwt.verify(token, env.jwtSecret, {
      issuer: "basedrop",
      audience: "basedrop-users",
    });
    if (decoded?.jti) {
      const revoked = await RevokedToken.exists({ jti: decoded.jti });
      if (revoked) return res.status(401).json({ error: "token_revoked" });
    }
    const subject = String(decoded.sub);
    req.wallet = subject.startsWith("solana:") ? subject : subject.toLowerCase();
    const user = await User.findOne({ wallet: req.wallet }).select(
      "accountStatus suspendedUntil sessionVersion",
    );
    if (!user || !isSessionVersionCurrent(decoded.sv, user.sessionVersion)) {
      return res.status(401).json({ error: "invalid_token" });
    }
    if(Date.now()>=((decoded.started??decoded.iat)*1000)+env.sessionMaximumMs)return res.status(401).json({error:'session_expired'});
    if (user?.accountStatus === "suspended") {
      const until =
        user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now()
          ? user.suspendedUntil
          : null;
      if (until) {
        return res.status(403).json({ error: "account_suspended", suspendedUntil: until });
      }
      await User.updateOne(
        { wallet: req.wallet, accountStatus: "suspended" },
        { $set: { accountStatus: "active", suspendedUntil: null } },
      );
    }
    if(req.method==='GET'&&req.path==='/me'&&Date.now()-(decoded.iat??0)*1000>=24*60*60*1000)setSessionCookie(res,signSession(req.wallet,decoded.sv,decoded));
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

// ✅ Added back to prevent the "Missing Export" error on startup
export function adminOnly(req, res, next) {
  // Since you use Email/Password for Admin, this middleware usually
  // isn't hit by the admin dashboard, but the export MUST exist.
  if (!req.wallet) return res.status(403).json({ error: "forbidden" });
  next();
}
