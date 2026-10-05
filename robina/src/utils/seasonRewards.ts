export const SEASON_2_END_AT = new Date("2026-09-10T00:00:00-07:00").getTime();

export function getSeasonRewardAmount(rank: number): number | null {
  if (rank === 1) return 500;
  if (rank === 2) return 300;
  if (rank === 3) return 200;
  if (rank === 4) return 150;
  if (rank === 5) return 100;
  if (rank >= 6 && rank <= 10) return 80;
  if (rank >= 11 && rank <= 20) return 70;
  if (rank >= 21 && rank <= 30) return 60;
  return null;
}

export function formatUsdReward(amount: number): string {
  return `$${amount.toLocaleString()}`;
}
