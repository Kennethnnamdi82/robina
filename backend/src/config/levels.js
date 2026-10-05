// Mirror of frontend src/types/game.ts LEVELS - server is the source of truth.
export const LEVELS = [
  { name: 'Beginner',      claimReward: 2,  instantClaimCost: 0.1, bdRequired: 0,      usdcPrice: 0 },
  { name: 'Bronze',        claimReward: 5,  instantClaimCost: 0.3, bdRequired: 120,    usdcPrice: 0.5 },
  { name: 'Silver',        claimReward: 10, instantClaimCost: 0.4, bdRequired: 350,    usdcPrice: 1.5 },
  { name: 'Gold',          claimReward: 15, instantClaimCost: 0.5, bdRequired: 900,    usdcPrice: 2.7 },
  { name: 'Platinum',      claimReward: 20, instantClaimCost: 0.6, bdRequired: 2200,   usdcPrice: 3.9 },
  { name: 'Diamond',       claimReward: 25, instantClaimCost: 0.7, bdRequired: 5000,   usdcPrice: 5.5 },
  { name: 'Master',        claimReward: 30, instantClaimCost: 0.8, bdRequired: 11000,  usdcPrice: 8.5 },
  { name: 'Grandmaster',   claimReward: 35, instantClaimCost: 0.9, bdRequired: 25000,  usdcPrice: 12 },
  { name: 'Legendary',     claimReward: 40, instantClaimCost: 1.0, bdRequired: 55000,  usdcPrice: 12.9 },
  { name: 'Top Legendary', claimReward: 50, instantClaimCost: 1.1, bdRequired: 120000, usdcPrice: 14.99 },
];

export const CLAIM_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours, matches frontend
export const AUTO_CLAIM_PRICE_USDC = 5;
export const AUTO_CLAIM_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const TASK_REWARD = 5;
export const DAILY_TASK_REWARD = 5;
export const REFERRAL_REWARD = 20;

export function getLevel(name) {
  return LEVELS.find((l) => l.name === name) || LEVELS[0];
}

export function getNextLevel(name) {
  const i = LEVELS.findIndex((l) => l.name === name);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
}