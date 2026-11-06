import 'dotenv/config';

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const cookieSameSite = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase();

if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('[env] COOKIE_SAMESITE must be one of: lax, strict, none');
}

// Retired mining/payment services must not impose requirements on login.
for (const key of ['MONGODB_URI', 'SIWE_DOMAIN', 'SIWE_URI', 'CORS_ORIGIN', 'JWT_SECRET', 'PRIVY_APP_ID', 'PRIVY_APP_SECRET']) {
  if (!process.env[key] || String(process.env[key]).trim() === '') {
    if (isProduction) throw new Error(`[env] Missing required ${key}`);
    console.warn(`[env] Missing ${key} - using development fallback`);
  }
}

const siweDomain = String(process.env.SIWE_DOMAIN || 'localhost:8080').trim();
const siweUri = String(process.env.SIWE_URI || 'http://localhost:8080').trim();
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080')
  .split(',').map(origin => origin.trim()).filter(Boolean);
const jwtSecret = String(process.env.JWT_SECRET || (isProduction ? '' : 'dev-only-insecure-secret-change-me-32chars')).trim();

if (isProduction && jwtSecret.length < 32) {
  throw new Error('[env] JWT_SECRET must be at least 32 characters in production');
}
if (isProduction && /dev-only|change[-_ ]?(me|this)|replace[-_ ]?(me|this)/i.test(jwtSecret)) {
  throw new Error('[env] JWT_SECRET must not use a development placeholder in production');
}

let parsedSiweUri;
try {
  parsedSiweUri = new URL(siweUri);
} catch {
  throw new Error('[env] SIWE_URI must be an absolute origin URL');
}
if (parsedSiweUri.origin !== siweUri ||
    parsedSiweUri.host.toLowerCase() !== siweDomain.toLowerCase() ||
    (isProduction && parsedSiweUri.protocol !== 'https:')) {
  throw new Error('[env] SIWE_DOMAIN and SIWE_URI must match the frontend origin');
}
if (isProduction && corsOrigins.some(origin => {
  try { const parsed = new URL(origin); return parsed.protocol !== 'https:' || parsed.origin !== origin; } catch { return true; }
})) throw new Error('[env] CORS_ORIGIN must contain HTTPS origins in production');
if (isProduction && !corsOrigins.includes(siweUri)) {
  throw new Error('[env] CORS_ORIGIN must include the SIWE_URI frontend origin');
}

if (cookieSameSite === 'none' && String(process.env.COOKIE_SECURE || 'false') !== 'true' && isProduction) {
  throw new Error('[env] COOKIE_SAMESITE=none requires COOKIE_SECURE=true in production');
}
if (isProduction && String(process.env.COOKIE_SECURE || 'true') !== 'true') {
  throw new Error('[env] COOKIE_SECURE=true is required in production');
}

// Retain the existing default challenge chain; wallet login still accepts the
// valid chain selected by the user. No payment RPC or treasury is needed.
const chainId = Number(process.env.CHAIN_ID || 4663);
if (chainId !== 4663) {
  throw new Error('[env] CHAIN_ID must be 4663 for Robinhood Chain mainnet');
}

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins,
  mongoUri: String(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/basedrop').trim(),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: String(process.env.COOKIE_SECURE || (isProduction ? 'true' : 'false')) === 'true',
  cookieSameSite,
  chainId,
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || null,
  siweDomain,
  siweUri,
  privyAppId: process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID || null,
  privyAppSecret: process.env.PRIVY_APP_SECRET || null,
  authNonceTtlMs: 5 * 60 * 1000,
};
