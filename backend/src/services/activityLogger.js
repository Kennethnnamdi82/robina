import { ActivityLog } from "../models/ActivityLog.js";
import { LoginSession } from "../models/LoginSession.js";

const UNKNOWN = "Unknown";

function clean(value) {
  const text = String(value || "").trim();
  return text || UNKNOWN;
}

function decodeHeaderValue(value) {
  try {
    return decodeURIComponent(String(value || "").trim()) || UNKNOWN;
  } catch {
    return clean(value);
  }
}

export function getClientIp(req) {
  try {
    const forwarded = String(req.headers["x-forwarded-for"] || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)[0];
    return clean(
      req.headers["cf-connecting-ip"] ||
        req.headers["x-real-ip"] ||
        req.headers["x-client-ip"] ||
        forwarded ||
        req.socket?.remoteAddress ||
        req.ip,
    );
  } catch {
    return UNKNOWN;
  }
}

export function parseUserAgent(userAgent) {
  try {
    const ua = String(userAgent || "");
    const lower = ua.toLowerCase();

    let browser = UNKNOWN;
    if (lower.includes("edg/")) browser = "Edge";
    else if (lower.includes("opr/") || lower.includes("opera")) browser = "Opera";
    else if (lower.includes("chrome/") || lower.includes("crios/")) browser = "Chrome";
    else if (lower.includes("firefox/") || lower.includes("fxios/")) browser = "Firefox";
    else if (lower.includes("safari/")) browser = "Safari";

    let operatingSystem = UNKNOWN;
    if (lower.includes("windows")) operatingSystem = "Windows";
    else if (lower.includes("android")) operatingSystem = "Android";
    else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) operatingSystem = "iOS";
    else if (lower.includes("mac os") || lower.includes("macintosh")) operatingSystem = "macOS";
    else if (lower.includes("linux")) operatingSystem = "Linux";

    let deviceType = "Desktop";
    if (lower.includes("tablet") || lower.includes("ipad")) deviceType = "Tablet";
    else if (lower.includes("mobi") || lower.includes("iphone") || lower.includes("android")) deviceType = "Mobile";
    if (!ua) deviceType = UNKNOWN;

    return { browser, operatingSystem, deviceType };
  } catch {
    return { browser: UNKNOWN, operatingSystem: UNKNOWN, deviceType: UNKNOWN };
  }
}

export function detectLoginSource(req) {
  try {
    const source = String(
      req.headers["x-login-source"] ||
        req.headers["x-source"] ||
        req.body?.source ||
        req.query?.source ||
        "",
    ).toLowerCase();
    const referer = String(req.headers.referer || req.headers.referrer || "").toLowerCase();
    const userAgent = String(req.headers["user-agent"] || "").toLowerCase();

    if (source.includes("telegram") || referer.includes("t.me") || userAgent.includes("telegram")) return "Telegram";
    if (source.includes("admin")) return "Admin";
    if (source.includes("mobile")) return "Mobile Web";
    if (referer || userAgent) return "Web";
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

export async function logActivity(data = {}) {
  try {
    const wallet = String(data.wallet || "").toLowerCase();
    await ActivityLog.create({
      wallet,
      username: data.username || (wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : UNKNOWN),
      activityType: data.activityType || "unknown_activity",
      activityDetails: data.activityDetails || "",
      module: data.module || "system",
      status: data.status || "success",
      amountUsdc: Number(data.amountUsdc || 0),
      bdAmount: Number(data.bdAmount || 0),
      txHash: data.txHash ? String(data.txHash).toLowerCase() : null,
      metadata: data.metadata || {},
    });
  } catch (e) {
    console.warn("[activityLogger] logActivity failed:", e?.message || e);
  }
}

export async function logLoginSession(req, wallet, extraData = {}) {
  try {
    const userAgent = clean(req.headers["user-agent"]);
    const parsed = parseUserAgent(userAgent);
    const session = await LoginSession.create({
      wallet: String(wallet || "").toLowerCase(),
      ipAddress: getClientIp(req),
      country: clean(req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"]),
      city: decodeHeaderValue(req.headers["x-vercel-ip-city"] || req.headers["cf-ipcity"]),
      browser: parsed.browser,
      deviceType: parsed.deviceType,
      operatingSystem: parsed.operatingSystem,
      loginSource: detectLoginSource(req),
      userAgent,
      metadata: extraData,
    });
    return session;
  } catch (e) {
    console.warn("[activityLogger] logLoginSession failed:", e?.message || e);
    return null;
  }
}
