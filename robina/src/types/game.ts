export type Level =
  | "Beginner"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master"
  | "Grandmaster"
  | "Legendary"
  | "Top Legendary";

export interface LevelInfo {
  name: Level;
  claimReward: number;
  instantClaimCost: number;
  bdRequired: number;
  usdcPrice: number;
  color: string;
  bgClass: string;
}

export const LEVELS: LevelInfo[] = [
  {
    name: "Beginner",
    claimReward: 2,
    instantClaimCost: 0.1,
    bdRequired: 0,
    usdcPrice: 0,
    color: "level-beginner",
    bgClass: "bg-level-beginner",
  },
  {
    name: "Bronze",
    claimReward: 5,
    instantClaimCost: 0.3,
    bdRequired: 120,
    usdcPrice: 0.5,
    color: "level-bronze",
    bgClass: "bg-level-bronze",
  },
  {
    name: "Silver",
    claimReward: 10,
    instantClaimCost: 0.4,
    bdRequired: 350,
    usdcPrice: 1.5,
    color: "level-silver",
    bgClass: "bg-level-silver",
  },
  {
    name: "Gold",
    claimReward: 15,
    instantClaimCost: 0.5,
    bdRequired: 900,
    usdcPrice: 2.7,
    color: "level-gold",
    bgClass: "bg-level-gold",
  },
  {
    name: "Platinum",
    claimReward: 20,
    instantClaimCost: 0.6,
    bdRequired: 2200,
    usdcPrice: 3.9,
    color: "level-platinum",
    bgClass: "bg-level-platinum",
  },
  {
    name: "Diamond",
    claimReward: 25,
    instantClaimCost: 0.7,
    bdRequired: 5000,
    usdcPrice: 5.5,
    color: "level-diamond",
    bgClass: "bg-level-diamond",
  },
  {
    name: "Master",
    claimReward: 30,
    instantClaimCost: 0.8,
    bdRequired: 11000,
    usdcPrice: 8.5,
    color: "level-master",
    bgClass: "bg-level-master",
  },
  {
    name: "Grandmaster",
    claimReward: 35,
    instantClaimCost: 0.9,
    bdRequired: 25000,
    usdcPrice: 12,
    color: "level-grandmaster",
    bgClass: "bg-level-grandmaster",
  },
  {
    name: "Legendary",
    claimReward: 40,
    instantClaimCost: 1.0,
    bdRequired: 55000,
    usdcPrice: 12.9,
    color: "level-legendary",
    bgClass: "bg-level-legendary",
  },
  {
    name: "Top Legendary",
    claimReward: 50,
    instantClaimCost: 1.1,
    bdRequired: 120000,
    usdcPrice: 14.99,
    color: "level-top-legendary",
    bgClass: "bg-level-top-legendary",
  },
];

export interface Task {
  id: string;
  title: string;
  description: string;
  icon: string;
  baseReward: number;
  completed: boolean;
  isDaily?: boolean;
  category?: string;
  actionUrl?: string;
  taskType?: "default" | "daily" | "temporary_engagement" | "campaign" | "event_community";
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  bd: number;
  level: Level;
}

export interface UserState {
  wallet: string;
  bd: number;
  level: Level;
  cardMultiplier: number;
  lastClaimTime: number;
  autoClaimActive: boolean;
  autoClaimExpiry: number;
  referralCount: number;
  referralCode: string;
  completedTasks: string[];
  boostUsesToday: number;
  lastBoostDate: string;
  lastDailyTaskDate: string;
}

export const CLAIM_COOLDOWN = 6 * 60 * 60 * 1000;
export const TASK_REWARD = 5;
export const DAILY_TASK_REWARD = 5;
export const REFERRAL_REWARD = 20;
export const AUTO_CLAIM_PRICE = 5;
export const AUTO_CLAIM_DURATION = 30 * 24 * 60 * 60 * 1000;
export const MIN_CARD_MULTIPLIER = 2;
export const MAX_CARD_MULTIPLIER = 100;

const CARD_MULTIPLIER_PRICE_BY_VALUE_USDC: Readonly<Record<number, number>> = {
  ...Object.fromEntries(
    Array.from(
      { length: MAX_CARD_MULTIPLIER - MIN_CARD_MULTIPLIER + 1 },
      (_, index) => {
        const multiplier = MIN_CARD_MULTIPLIER + index;
        return [multiplier, (multiplier - 1) * 2];
      },
    ),
  ),
};

export function getCardMultiplierPrice(multiplier: number): number {
  return CARD_MULTIPLIER_PRICE_BY_VALUE_USDC[multiplier] ?? 0;
}

export function getLevelInfo(level: Level): LevelInfo {
  return LEVELS.find((l) => l.name === level) || LEVELS[0];
}

export function getNextLevel(level: Level): LevelInfo | null {
  const idx = LEVELS.findIndex((l) => l.name === level);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

// Replace your existing shortenWallet function with this:
export function shortenWallet(wallet: string | undefined | null): string {
  // Guard: If wallet is missing or not a string, return a placeholder
  if (!wallet || typeof wallet !== "string") {
    return "No Wallet";
  }

  // Guard: If the string is too short to slice properly
  if (wallet.length < 10) {
    return wallet;
  }

  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}
export function getInstantClaimCost(level: Level): number {
  return getLevelInfo(level).instantClaimCost;
}

export function getClaimReward(level: Level): number {
  return getLevelInfo(level).claimReward;
}
