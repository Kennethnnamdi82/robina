import 'dotenv/config';
import bs58 from 'bs58';

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const cookieSameSite = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const walletRegex = /^0x[a-fA-F0-9]{40}$/;
const ROBINHOOD_CHAIN_ID = 4663;
const BASE_CHAIN_ID = 8453;

if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('[env] COOKIE_SAMESITE must be one of: lax, strict, none');
}

const required = [
  'MONGODB_URI',
  'ROBINHOOD_RPC_URL',
  'ROBINHOOD_USDC_CONTRACT',
  'BASE_RPC_URL',
  'BASE_USDC_CONTRACT',
  'SOLANA_RPC_URL',
  'SIWE_DOMAIN',
  'SIWE_URI',
  'CORS_ORIGIN',
  'JWT_SECRET',
  'TREASURY_WALLET',
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'PRIVY_VERIFICATION_KEY',
];

for (const key of required) {
  if (!process.env[key] || String(process.env[key]).trim() === '') {
    if (isProduction) {
      throw new Error(`[env] Missing required ${key}`);
    }
    console.warn(`[env] Missing ${key} - using development fallback`);
  }
}

const siweDomain = String(process.env.SIWE_DOMAIN || 'localhost:8080').trim();
const siweUri = String(process.env.SIWE_URI || 'http://localhost:8080').trim();
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const jwtSecret = String(process.env.JWT_SECRET || (isProduction ? '' : 'dev-only-insecure-secret-change-me-32chars')).trim();
if (isProduction && jwtSecret.length < 32) {
  throw new Error('[env] JWT_SECRET must be at least 32 characters in production');
}
if (isProduction && /dev-only|change-me/i.test(jwtSecret)) {
  throw new Error('[env] JWT_SECRET must not use a development placeholder in production');
}

const mongoUri = String(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/basedrop').trim();
const robinhoodRpcUrl = String(process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com').trim();
const baseRpcUrl = String(process.env.BASE_RPC_URL || 'https://mainnet.base.org').trim();
const solanaRpcUrl = String(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com').trim();
if (isProduction) {
  for (const [name, value] of [
    ['ROBINHOOD_RPC_URL', robinhoodRpcUrl],
    ['BASE_RPC_URL', baseRpcUrl],
    ['SOLANA_RPC_URL', solanaRpcUrl],
  ]) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`[env] ${name} must be an absolute HTTPS URL in production`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`[env] ${name} must use HTTPS in production`);
    }
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
const baseUsdcContract = String(
  process.env.BASE_USDC_CONTRACT || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
).trim().toLowerCase();
if (!walletRegex.test(baseUsdcContract)) {
  throw new Error('[env] BASE_USDC_CONTRACT must be a valid Base USDC token address');
}
const solanaUsdcMint = String(
  process.env.SOLANA_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
).trim();
const solanaTreasuryWallet = String(process.env.SOLANA_TREASURY_WALLET || '').trim();
if (isProduction && !solanaTreasuryWallet) {
  throw new Error('[env] Missing required SOLANA_TREASURY_WALLET');
}
try {
  if (bs58.decode(solanaUsdcMint).length !== 32) throw new Error('invalid Solana mint');
  if (solanaTreasuryWallet && bs58.decode(solanaTreasuryWallet).length !== 32) {
    throw new Error('invalid Solana treasury');
  }
} catch {
  throw new Error('[env] SOLANA_USDC_MINT and SOLANA_TREASURY_WALLET must be valid Solana public keys');
}

if (!process.env.TREASURY_WALLET && !process.env.ADMIN_WALLET) {
  if (isProduction) throw new Error('[env] Missing TREASURY_WALLET (or legacy ADMIN_WALLET)');
  console.warn('[env] Missing TREASURY_WALLET - using development fallback');
}

if (cookieSameSite === 'none' && String(process.env.COOKIE_SECURE || 'false') !== 'true' && isProduction) {
  throw new Error('[env] COOKIE_SAMESITE=none requires COOKIE_SECURE=true in production');
}
if (isProduction && String(process.env.COOKIE_SECURE || 'true') !== 'true') {
  throw new Error('[env] COOKIE_SECURE=true is required in production');
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
  mongoUri,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: String(process.env.COOKIE_SECURE || (isProduction ? 'true' : 'false')) === 'true',
  cookieSameSite,
  chainId: ROBINHOOD_CHAIN_ID,
  robinhoodRpcUrl,
  baseRpcUrl,
  usdcContract,
  baseUsdcContract,
  treasuryWallet,
  adminWallet: treasuryWallet,
  adminAuthWallet,
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || null,
  siweDomain,
  siweUri,
  minConfirmations: parseInt(process.env.MIN_CONFIRMATIONS || (isProduction ? '3' : '1'), 10),
  privyAppId: process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID || null,
  privyAppSecret: process.env.PRIVY_APP_SECRET || null,
  privyVerificationKey: process.env.PRIVY_VERIFICATION_KEY || null,
  authNonceTtlMs: 5 * 60 * 1000,
  paymentIntentTtlMs: parseInt(process.env.PAYMENT_INTENT_TTL_MS || '900000', 10),
  solanaRpcUrl,
  solanaUsdcMint,
  solanaTreasuryWallet: solanaTreasuryWallet || null,
  evmRpcUrls: {
    [String(ROBINHOOD_CHAIN_ID)]: robinhoodRpcUrl,
    [String(BASE_CHAIN_ID)]: baseRpcUrl,
    ...Object.fromEntries(
      String(process.env.EVM_RPC_URLS || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => entry.split('='))
        .filter(([chainId, url]) => /^\d+$/.test(chainId) && /^https?:\/\//.test(url || '')),
    ),
  },
  evmChains: {
    [String(ROBINHOOD_CHAIN_ID)]: {
      chainId: ROBINHOOD_CHAIN_ID,
      name: 'Robinhood Chain',
      rpcUrl: robinhoodRpcUrl,
      usdcContract,
    },
    [String(BASE_CHAIN_ID)]: {
      chainId: BASE_CHAIN_ID,
      name: 'Base',
      rpcUrl: baseRpcUrl,
      usdcContract: baseUsdcContract,
    },
  },
};
