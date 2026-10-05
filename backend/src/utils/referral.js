import crypto from 'node:crypto';

export function generateReferralCode(wallet) {
  const hash = crypto.createHash('sha256').update(wallet.toLowerCase()).digest('hex');
  return `BD-${hash.slice(0, 6).toUpperCase()}`;
}