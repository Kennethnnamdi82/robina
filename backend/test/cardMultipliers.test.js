import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCardMultiplierToBdPoints,
  cardMultiplierPriceUsdc,
  effectiveCardMultiplier,
  normalizeCardMultiplier,
} from "../src/config/cardMultipliers.js";

test("normalizes only purchasable multiplier values", () => {
  assert.equal(normalizeCardMultiplier(2), 2);
  assert.equal(normalizeCardMultiplier("100"), 100);
  assert.equal(normalizeCardMultiplier(1), null);
  assert.equal(normalizeCardMultiplier(101), null);
  assert.equal(normalizeCardMultiplier(2.5), null);
});

test("uses configured multiplier prices", () => {
  assert.equal(cardMultiplierPriceUsdc(2), 2);
  assert.equal(cardMultiplierPriceUsdc(3), 4);
  assert.equal(cardMultiplierPriceUsdc(100), 198);
  assert.equal(cardMultiplierPriceUsdc(1), null);
});

test("applies multiplier to BD point rewards", () => {
  assert.equal(effectiveCardMultiplier({ cardMultiplier: 2 }), 2);
  assert.equal(applyCardMultiplierToBdPoints(2, { cardMultiplier: 2 }), 4);
  assert.equal(applyCardMultiplierToBdPoints(5, { cardMultiplier: 100 }), 500);
  assert.equal(applyCardMultiplierToBdPoints(3, { cardMultiplier: 1 }), 3);
});
