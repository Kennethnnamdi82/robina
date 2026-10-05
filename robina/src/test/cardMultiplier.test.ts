import { describe, expect, it } from "vitest";
import {
  getCardMultiplierPrice,
  MAX_CARD_MULTIPLIER,
  MIN_CARD_MULTIPLIER,
} from "@/types/game";

describe("card multiplier pricing", () => {
  it("uses configured one-time prices", () => {
    expect(MIN_CARD_MULTIPLIER).toBe(2);
    expect(MAX_CARD_MULTIPLIER).toBe(100);
    expect(getCardMultiplierPrice(2)).toBe(2);
    expect(getCardMultiplierPrice(3)).toBe(4);
    expect(getCardMultiplierPrice(100)).toBe(198);
  });
});
