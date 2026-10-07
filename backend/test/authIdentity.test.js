import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/User.js";
import { getVerifiedGoogleAccount } from "../src/services/authIdentity.js";

test("Google login only accepts a verified Google account from the Privy user", () => {
  assert.deepEqual(
    getVerifiedGoogleAccount({
      linked_accounts: [
        { type: "email", address: "unverified@example.com" },
        { type: "google_oauth", email: " Verified@Example.com " },
      ],
    }),
    { email: "verified@example.com" },
  );
});

test("Google login rejects Privy identities without a verified Google account", () => {
  assert.equal(
    getVerifiedGoogleAccount({
      linked_accounts: [{ type: "wallet", address: "0x123" }],
    }),
    null,
  );
  assert.equal(getVerifiedGoogleAccount(null), null);
});

test("user schema distinguishes Google and wallet identities", () => {
  assert.deepEqual(User.schema.path("authMethod").enumValues, [
    "wallet_evm",
    "wallet_solana",
    "privy_google",
  ]);
  assert.deepEqual(User.schema.path("chainType").enumValues, ["evm", "solana", "none"]);
  assert.equal(User.schema.path("privyUserId").options.unique, true);
  assert.equal(User.schema.path("wallet").options.unique, true);
});
