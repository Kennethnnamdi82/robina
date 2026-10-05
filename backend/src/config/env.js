import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';
const cookieSameSite = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const walletRegex = /^0x[a-fA-F0-9]{40}$/;

if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('[env] COOKIE_SAMESITE must be one of: lax, strict, none');
}

const required = ['JWT_SECRET', 'MONGODB_URI', 'BASE_RPC_URL', 'USDC_CONTRACT'];
for (const key of required) {
  if (!process.env[key]) {
    if (isProduction) throw new Error(`[env] Missing required ${key}`);
    console.warn(`[env] Missing ${key} - using development fallback`);
  }
}

if (!process.env.TREASURY_WALLET && !process.env.ADMIN_WALLET) {
  if (isProduction) throw new Error('[env] Missing TREASURY_WALLET (or legacy ADMIN_WALLET)');
  console.warn('[env] Missing TREASURY_WALLET - using development fallback');
}

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('[env] JWT_SECRET must be at least 32 characters in production');
}
if (cookieSameSite === 'none' && String(process.env.COOKIE_SECURE || 'false') !== 'true' && isProduction) {
  throw new Error('[env] COOKIE_SAMESITE=none requires COOKIE_SECURE=true in production');
}

const treasuryWallet = (process.env.TREASURY_WALLET || process.env.ADMIN_WALLET || '0x000000000000000000000000000000000000dEaD').toLowerCase();
const adminAuthWallet = (
  process.env.ADMIN_LOGIN_WALLET ||
  process.env.ADMIN_AUTH_WALLET ||
  treasuryWallet
).toLowerCase();

if (!walletRegex.test(treasuryWallet)) {
  throw new Error('[env] TREASURY_WALLET (or ADMIN_WALLET alias) must be a valid 0x wallet');
}
if (!walletRegex.test(adminAuthWallet)) {
  throw new Error('[env] ADMIN_LOGIN_WALLET (or ADMIN_AUTH_WALLET alias) must be a valid 0x wallet');
}

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/basedrop',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: String(process.env.COOKIE_SECURE || (isProduction ? 'true' : 'false')) === 'true',
  cookieSameSite,
  chainId: parseInt(process.env.CHAIN_ID || '8453', 10),
  baseRpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  usdcContract: (process.env.USDC_CONTRACT || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase(),
  treasuryWallet,
  // Legacy alias retained for backward compatibility.
  adminWallet: treasuryWallet,
  adminAuthWallet,
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || null,
  siweDomain: process.env.SIWE_DOMAIN || 'localhost:8080',
  siweUri: process.env.SIWE_URI || 'http://localhost:8080',
  minConfirmations: parseInt(process.env.MIN_CONFIRMATIONS || (isProduction ? '3' : '1'), 10),
};
