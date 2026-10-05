import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { RevokedToken } from "../models/RevokedToken.js";

export function signSession(wallet, sv = 0) {
  return jwt.sign({ sub: wallet.toLowerCase(), sv }, env.jwtSecret, {
    expiresIn: "7d",
    issuer: "basedrop",
    audience: "basedrop-users",
    jwtid: crypto.randomBytes(16).toString("hex"),
  });
}

export function setSessionCookie(res, token) {
  res.cookie("bd_session", token, {
    httpOnly: true,
    sameSite: "none", // Required for Render
    secure: true, // Required for HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie("bd_session", { path: "/", sameSite: "none", secure: true });
}

export async function web3Middleware(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const token = bearerToken || req.cookies?.bd_session;
    if (!token) return res.status(401).json({ error: "unauthenticated" });
    const decoded = jwt.verify(token, env.jwtSecret, {
      issuer: "basedrop",
      audience: "basedrop-users",
    });
    if (decoded?.jti) {
      const revoked = await RevokedToken.exists({ jti: decoded.jti });
      if (revoked) return res.status(401).json({ error: "token_revoked" });
    }
    req.authToken = token;
    req.wallet = String(decoded.sub).toLowerCase();
    const user = await User.findOne({ wallet: req.wallet }).select(
      "accountStatus suspendedUntil",
    );
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
