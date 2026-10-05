import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';
const cookieSameSite = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const walletRegex = /^0x[a-fA-F0-9]{40}$/;
const siweDomain = String(process.env.SIWE_DOMAIN || 'localhost:8080').trim();
const siweUri = String(process.env.SIWE_URI || 'http://localhost:8080').trim();
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('[env] COOKIE_SAMESITE must be one of: lax, strict, none');
}

const ROBINHOOD_CHAIN_ID = 4663;
const required = [
  'JWT_SECRET',
  'MONGODB_URI',
  'ROBINHOOD_RPC_URL',
  'ROBINHOOD_USDC_CONTRACT',
  'SIWE_DOMAIN',
  'SIWE_URI',
  'CORS_ORIGIN',
];
for (const key of required) {
  if (!process.env[key]) {
    if (isProduction) throw new Error(`[env] Missing required ${key}`);
    console.warn(`[env] Missing ${key} - using development fallback`);
  }
}

let parsedSiweUri;
try {
  parsedSiweUri = new URL(siweUri);
} catch {
  throw new Error('[env] SIWE_URI must be an absolute origin URL');
}
if (
  parsedSiweUri.origin !== siweUri ||
  parsedSiweUri.host.toLowerCase() !== siweDomain.toLowerCase() ||
  (isProduction && parsedSiweUri.protocol !== 'https:')
) {
  throw new Error('[env] SIWE_DOMAIN and SIWE_URI must match the frontend origin');
}
if (isProduction && !corsOrigins.includes(siweUri)) {
  throw new Error('[env] CORS_ORIGIN must include the SIWE_URI frontend origin');
}

const configuredChainId = Number(process.env.CHAIN_ID || ROBINHOOD_CHAIN_ID);
if (configuredChainId !== ROBINHOOD_CHAIN_ID) {
  throw new Error('[env] CHAIN_ID must be 4663 for Robinhood Chain mainnet');
}

const usdcContract = String(
  process.env.ROBINHOOD_USDC_CONTRACT || '0x80e0e24718dbfcad49ecaa6f1e6c89a190586ca8',
).trim().toLowerCase();
if (!walletRegex.test(usdcContract)) {
  throw new Error('[env] ROBINHOOD_USDC_CONTRACT must be a valid Robinhood Chain token address');
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
  corsOrigins,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/basedrop',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: String(process.env.COOKIE_SECURE || (isProduction ? 'true' : 'false')) === 'true',
  cookieSameSite,
  chainId: ROBINHOOD_CHAIN_ID,
  robinhoodRpcUrl: process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
  usdcContract,
  treasuryWallet,
  // Legacy alias retained for backward compatibility.
  adminWallet: treasuryWallet,
  adminAuthWallet,
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || null,
  siweDomain,
  siweUri,
  minConfirmations: parseInt(process.env.MIN_CONFIRMATIONS || (isProduction ? '3' : '1'), 10),
};
