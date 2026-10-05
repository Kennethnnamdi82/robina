export const CARD_MULTIPLIER_MIN = 2;
export const CARD_MULTIPLIER_MAX = 100;

const CARD_MULTIPLIER_PRICE_BY_VALUE_USDC = Object.freeze({
  ...Object.fromEntries(
    Array.from(
      { length: CARD_MULTIPLIER_MAX - CARD_MULTIPLIER_MIN + 1 },
      (_, index) => {
        const multiplier = CARD_MULTIPLIER_MIN + index;
        return [multiplier, (multiplier - 1) * 2];
      },
    ),
  ),
});

export function normalizeCardMultiplier(value) {
  const n = Number(value);
  if (
    !Number.isInteger(n) ||
    n < CARD_MULTIPLIER_MIN ||
    n > CARD_MULTIPLIER_MAX
  ) {
    return null;
  }
  return n;
}

export function effectiveCardMultiplier(user) {
  const value = Number(user?.cardMultiplier || 1);
  return Number.isFinite(value)
    ? Math.min(CARD_MULTIPLIER_MAX, Math.max(1, Math.floor(value)))
    : 1;
}

export function cardMultiplierPriceUsdc(multiplier) {
  const normalized = normalizeCardMultiplier(multiplier);
  if (!normalized) return null;
  return CARD_MULTIPLIER_PRICE_BY_VALUE_USDC[normalized] ?? null;
}

export function applyCardMultiplierToBdPoints(baseBdPoints, user) {
  return Number(baseBdPoints || 0) * effectiveCardMultiplier(user);
}
