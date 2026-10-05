import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env.js";
import { RevokedToken } from "../models/RevokedToken.js";

const ADMIN_LOGIN_MAX_ATTEMPTS = 3;
const ADMIN_LOGIN_LOCK_MS = 60 * 60 * 1000;
const adminLoginAttempts = new Map();

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

function attemptKey(email, ip) {
  return `${String(email || "").trim().toLowerCase()}|${ip}`;
}

function getAttemptState(key) {
  const state = adminLoginAttempts.get(key);
  if (!state) return { count: 0, lockUntil: 0 };
  if (state.lockUntil && Date.now() >= state.lockUntil) {
    adminLoginAttempts.delete(key);
    return { count: 0, lockUntil: 0 };
  }
  return state;
}

function recordFailure(key) {
  const state = getAttemptState(key);
  const nextCount = Number(state.count || 0) + 1;
  if (nextCount >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    const locked = { count: nextCount, lockUntil: Date.now() + ADMIN_LOGIN_LOCK_MS };
    adminLoginAttempts.set(key, locked);
    return locked;
  }
  const updated = { count: nextCount, lockUntil: 0 };
  adminLoginAttempts.set(key, updated);
  return updated;
}

function clearAttempts(key) {
  adminLoginAttempts.delete(key);
}

async function isValidAdminCredentials(email, password) {
  if (!env.adminEmail || !env.adminPasswordHash) return false;
  if (String(email || "").trim().toLowerCase() !== env.adminEmail) return false;
  try {
    return await bcrypt.compare(String(password || ""), env.adminPasswordHash);
  } catch {
    return false;
  }
}

// Helper for route-level checks
export function tryAdminCookie(req) {
  try {
    const token = req.cookies?.bd_admin;
    if (!token) return null;
    return jwt.verify(token, env.jwtSecret, {
      issuer: "basedrop-admin",
      audience: "basedrop-admin",
    });
  } catch {
    return null;
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  const key = attemptKey(email, clientIp(req));
  const state = getAttemptState(key);
  if (state.lockUntil && Date.now() < state.lockUntil) {
    return res.status(429).json({ error: "try again later" });
  }

  const valid = await isValidAdminCredentials(email, password);
  if (!valid) {
    const failed = recordFailure(key);
    if (failed.lockUntil && Date.now() < failed.lockUntil) {
      return res.status(429).json({ error: "try again later" });
    }
    return res.status(401).json({ error: "invalid credentials" });
  }
  clearAttempts(key);

  const token = jwt.sign(
    { sub: "admin", role: "admin", email },
    env.jwtSecret,
    {
      expiresIn: "12h",
      issuer: "basedrop-admin",
      audience: "basedrop-admin",
      jwtid: crypto.randomBytes(16).toString("hex"),
    },
  );

  res.cookie("bd_admin", token, {
    httpOnly: true,
    sameSite: "none", // Required for Render cross-domain
    secure: true, // Required for HTTPS
    path: "/",
  });

  res.json({ ok: true, admin: { email } });
}

export async function me(req, res) {
  const admin = tryAdminCookie(req);
  if (!admin) return res.status(401).json({ error: "unauthenticated" });
  if (admin.jti) {
    const revoked = await RevokedToken.exists({ jti: admin.jti });
    if (revoked) return res.status(401).json({ error: "token_revoked" });
  }

  res.json({ admin: { email: admin.email } });
}

export async function logout(req, res) {
  const admin = tryAdminCookie(req);
  if (admin?.jti) {
    const expiresAt = admin.exp ? new Date(admin.exp * 1000) : new Date(Date.now() + 12 * 3600000);
    await RevokedToken.updateOne(
      { jti: admin.jti },
      { $setOnInsert: { kind: "admin", expiresAt } },
      { upsert: true },
    );
  }
  res.clearCookie("bd_admin", { path: "/", sameSite: "none", secure: true });
  res.json({ ok: true });
}
