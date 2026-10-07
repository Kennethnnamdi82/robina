import test from "node:test";
import assert from "node:assert/strict";
import { isSessionVersionCurrent } from "../src/services/sessionVersion.js";

test("accepts a session whose version matches the user record", () => {
  assert.equal(isSessionVersionCurrent(0, 0), true);
  assert.equal(isSessionVersionCurrent(4, 4), true);
});

test("rejects stale or malformed session versions", () => {
  assert.equal(isSessionVersionCurrent(0, 1), false);
  assert.equal(isSessionVersionCurrent(undefined, 0), false);
  assert.equal(isSessionVersionCurrent("0", 0), false);
});

test("treats a missing database session version as the initial version", () => {
  assert.equal(isSessionVersionCurrent(0, undefined), true);
});
