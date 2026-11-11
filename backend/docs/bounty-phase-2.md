# Bounty & Earn backend (Phase 2)

This module extends the existing Express/Mongoose ESM backend, `bd_session` player sessions and `bd_admin` owner sessions. It does not replace authentication, touch the game's/store's balances, or change the Phase 1 UI. TypeScript wire interfaces are in `src/bounties/contracts.d.ts`; runtime validation uses the existing Zod dependency.

## API contract

All routes below are under `/api`. All require the appropriate existing cookie, send `Cache-Control: no-store`, and return JSON. Mutation requests require `Content-Type: application/json` and `X-Rivals-Bounty: 1`, including requests with an empty `{}` body. Existing CORS origin checks also apply. Do not bypass them for Capacitor: use the existing authenticated native relay/session workflow in Phase 3.

All monetary fields are **decimal strings of integer micro-units** (6 decimals): `"5000000"` is 5 USDC. Mongo stores signed BSON Int64 via Mongoose BigInt; arithmetic is native BigInt. The accounting ceiling is 9,000,000,000,000,000 micro-units. No floats are used. Addresses identify an EVM recipient; format validation cannot prove that a player controls an address or that an exchange supports Base deposits. Phase 3 must clearly confirm **Base native USDC** and the destination before requesting withdrawal.

Lists accept `?limit=30&before=<lastObjectId>` (1–100 items), returning `{ items, nextBefore }`. Fetch subsequent pages until `nextBefore` is null. Other query keys are rejected on list routes. Empty lists are real empty states, not demo data.

| Player route | Purpose |
| --- | --- |
| `GET /bounties/tasks` | Active published tasks, including capacity/budget information |
| `GET /bounties/tasks/:id` | Active task instructions and current terms |
| `POST /bounties/tasks/:id/submissions` | `{postUrl,evidenceUrl?,evidenceNotes?,confirmed:true}` → Pending |
| `GET /bounties/submissions` | Own submissions with promised terms and review outcome |
| `GET /bounties/wallet` | Available, reserved, pending, lifetime earned, withdrawn, minimum, saved address, payout availability |
| `PUT /bounties/wallet/address` | `{address}`; validates but does not connect a wallet or send funds |
| `GET /bounties/ledger` | Own immutable reward/reservation/settlement entries |
| `POST /bounties/withdrawals` | `{amountMicros,address,confirmed:true}` plus `Idempotency-Key` header (16–100 letters/digits/underscore/hyphen) |
| `GET /bounties/withdrawals` | Own withdrawal history and transaction hashes |
| `GET /bounties/notifications` | Personal notifications and globally published bounties, with read state |
| `POST /bounties/notifications/read` | `{}` marks currently existing notifications read |

| Admin route | Purpose |
| --- | --- |
| `GET /admin/bounties/tasks` | All tasks |
| `POST /admin/bounties/tasks` | Create draft; input shown below |
| `PUT /admin/bounties/tasks/:id` | Full edit; increments terms revision |
| `PATCH /admin/bounties/tasks/:id/status` | `{status:"active"\|"paused"\|"closed"}` |
| `GET /admin/bounties/submissions?status=pending` | Pending review queue (also approved/rejected) |
| `GET /admin/bounties/submissions/:id` | Post/evidence URLs, snapshotted requirements, review and risk flags |
| `POST /admin/bounties/submissions/:id/review` | Approve with required verification attestation, or reject with reason |
| `GET /admin/bounties/withdrawals?status=pending` | Withdrawals; status optional |
| `POST /admin/bounties/withdrawals/:id/review` | Authorize payout or reject a still-unsigned request with reason |
| `POST /admin/bounties/withdrawals/:id/execute` | `{}` signs/persists/broadcasts an authorized payment, or safely rebroadcasts its same bytes |
| `POST /admin/bounties/withdrawals/:id/reconcile` | `{}` verifies a prepared/broadcast payment without creating a new payment |
| `GET /admin/bounties/audit` | Append-only administrative/security history |

Task input example:

```json
{
  "title": "RIVALS Original X Post",
  "description": "Create an original promotional post about RIVALS.",
  "platform": "x",
  "instructions": ["Use your own account and original content.", "Supply ownership and live engagement analytics."],
  "disclosure": "Clearly disclose the promotional reward, including #ad where appropriate.",
  "minimumEngagement": 5000,
  "rewardMicros": "10000000",
  "budgetMicros": "100000000",
  "participationLimit": 10,
  "evidenceRequired": true
}
```

TikTok uses platform `tiktok`, minimumEngagement `5000`, rewardMicros `"5000000"`. `node scripts/seed-bounty-tasks.mjs --create-drafts` explicitly creates both examples as drafts with small 10-participant budgets; it never publishes or funds them. Review campaign funding and terms before publishing. Budgets are commitment caps, **not proof of treasury funding**.

Approval example:

```json
{
  "decision": "approve",
  "verificationMethod": "manual",
  "ownershipVerified": true,
  "engagementVerified": true,
  "complianceVerified": true,
  "disclosureVerified": true,
  "observedEngagement": 5000,
  "notes": "Describe independent ownership, genuine engagement and disclosure checks.",
  "acknowledgeRisk": false
}
```

Rejection: `{ "decision": "reject", "reason": "Specific player-visible reason" }`. Withdrawal approval: `{ "decision": "approve", "notes": "Destination/source checks", "acknowledgeRisk": false }`. A flagged submission/withdrawal requires `acknowledgeRisk:true` and a meaningful verification record. Notes are audit evidence, not automated proof.

## Review, budgets and accounting

- No authorized X/TikTok analytics integrations exist in this repository. **Manual independent review is required.** A submitted URL, screenshot, notes, or client metrics never automatically credits a reward. Admin tooling must open links safely (`noopener,noreferrer`, no untrusted HTML embedding) and verify live analytics/account ownership using an authorized process. Promotional disclosure requirements are configurable campaign terms, not jurisdiction-specific legal advice.
- Accept full HTTPS X/Twitter status or TikTok `@creator/video` URLs only. Strip tracking and deduplicate globally by platform/post ID, including renamed handles/host aliases. Reject shortlinks; do not resolve redirects or fetch URLs server-side. Evidence is bounded HTTPS link data only, not file uploads. Private/local literal hosts are rejected; even accepted DNS names must never be fetched by this backend (DNS rebinding is not solved by a URL regex).
- Unique indexes enforce one submission per player/task forever, even after rejection, and one post across accounts/tasks. Submitted terms are snapshotted. An edit cannot lower a budget below its existing commitments or participation limit below lifetime participants. Closed tasks cannot reopen. Pausing/closing does not void already accepted submissions.
- A pending submission reserves its promised reward from the campaign budget. Rejection frees that reward commitment but does not free a player's repeat-submission eligibility or lifetime participant slot. Approval converts reserved budget to rewarded budget; it cannot overrun the campaign cap. Existing pending submissions remain reviewable after edits/closure.
- Pending rewards are estimates only. Approval atomically updates submission status, wallet, ledger, campaign reward count, audit records and notices. Reward entry key `reward:<submissionId>` is unique. Repeating the same final review returns the existing result; changing a final decision is rejected. No direct edit-balance API exists.
- Withdrawal creation atomically moves available → reserved and writes the request, ledger and notice. Same player/key/same payload returns the same request; reuse with a different payload is rejected. Separate keys cannot overspend. Admin rejection releases once while pending or approved but still unsigned. Authorization does not mark funds paid. A rejection racing signing cannot release a committed signed intent.
- Ledger amounts are positive magnitudes; `kind` specifies direction. Do not sum amounts without their kind. `withdrawal_reserved` moves available to reserved; `withdrawal_paid` consumes reserved and increases withdrawn; `withdrawal_released` moves reserved back to available. `earnedMicros = availableMicros + reservedMicros + withdrawnMicros` for the supported no-fee/no-adjustment workflow. Pending rewards are separate.
- BSON balances are materialized and updated in the same transaction as their ledger entries, with explicit bounds. There are no standalone balance setters, generic ledger mutation endpoints, or dependencies on `User.bdBalance`/store/game cash. The model rejects ledger/audit updates and deletes. Production DB access controls/backups are still essential: application hooks cannot protect against a database administrator directly modifying collections.

## Mongo deployment

Use the existing MongoDB infrastructure, but it **must support transactions** (replica set, including Atlas, or mongos). A standalone server is not sufficient. Startup checks the topology, creates required unique indexes, initializes the treasury lane, and only then listens. Index conflicts fail startup instead of accepting unsafe writes. No Redis, queue service, new production dependency, or automatic scheduler is introduced.

`mongodb-memory-server` is the sole new **development-only** dependency: automated tests start a temporary real single-node replica set, never the production database. Its first install/test downloads an official MongoDB binary. Run `npm ci` with development dependencies for tests; deploy the backend with `npm ci --omit=dev` if desired.

Persistent per-account and HMAC-hashed-IP rate limits cover submissions (10/hour), withdrawal requests (10/hour), address changes (20/hour), and admin mutations (200/hour). Mongo TTL removes expired rate buckets. Shared submission networks, duplicate account email records and reused payout addresses flag review; they do **not prove** multiple accounts belong to the same person. IP hashes are not exposed in APIs. Existing identity/session checks remain in force. Configure the existing trusted reverse proxy correctly: do not forward arbitrary client-controlled forwarding headers as a trusted hop.

## Base mainnet treasury configuration

Keep all these in **backend secret configuration only**. Never use `VITE_*`, commit secrets, or paste private keys into chat/CLI arguments.

| Backend setting | Meaning |
| --- | --- |
| `BOUNTY_PAYOUTS_ENABLED=false` | Default; auth/bounties work without treasury credentials; execution/reconciliation return 503 |
| `BOUNTY_BASE_RPC_URL` | Trusted HTTPS Base-mainnet RPC; provider must support `finalized` blocks |
| `BOUNTY_TREASURY_PRIVATE_KEY` | Dedicated backend EOA signer secret, `0x` + 64 hex chars |
| `BOUNTY_TREASURY_ADDRESS` | Explicit expected signer address; must match key |
| `BOUNTY_MAX_PAYOUT_MICROS=100000000` | Default per-payment safety limit: 100 USDC |
| `BOUNTY_MAX_FEE_PER_GAS_WEI=1000000000` | Default 1 gwei fee cap |

The bounty chain is fixed independently to **Base 8453**, native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals, as listed by [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses). It does not alter the existing authentication challenge chain setting (4663). The treasury pays ETH gas; player USDC is not charged a fee. Fund and monitor both treasury native USDC and ETH; internal ledger promises are not actual treasury deposits. Default gas/payout limits may require an operator decision for larger amounts.

Use a **dedicated treasury signer exclusively for this backend across all replicas**. Do not rotate it, manually spend its nonce, or run another application using it while a payment is prepared/broadcast. Mongo serializes the treasury to one unresolved payment at a time. This prioritizes payout safety over throughput and intentionally blocks later payments until the active intent is resolved.

## Crash recovery and reconciliation

Withdrawal states:

```text
pending → rejected (reservation released)
approved → rejected (only before transaction preparation; reservation released)
pending → approved → prepared → broadcast → paid
                                  └────────→ failed (finalized revert; released)
```

`prepared` means nonce, chain, recipient, exact amount, signed transaction and deterministic hash were durably committed **before** the first network broadcast. Mongo transaction callbacks may retry signing but never broadcast. Crashes before commit cannot send funds. Crashes after commit recover the same signed bytes/hash, never a fresh nonce. The raw transaction is hidden from both player and admin API responses.

Execute/reconcile returns current state; it does not promise immediate settlement. Receipt absence, RPC errors, timeout, dropped/underpriced transaction, reorg, unexpected receipt or missing USDC Transfer event keep funds reserved and the treasury lane locked. A reverted receipt is not sufficient until its block is finalized. Success requires the configured chain, canonical finalized block, exact transaction sender/token/calldata/nonce/value, and the native token's matching Transfer event. An unrelated supplied hash is never accepted.

There is deliberately **no force-refund, replace-hash, re-sign, nonce reset or timed reservation expiry API**. Repeated `execute` rebroadcasts the same intent; `reconcile` only reads the chain. These are operator-driven, with no background infrastructure. Admin integration should surface prepared/broadcast rows and poll/reconcile them. If fees become stale or a signer was used externally, keep funds reserved and investigate with the recorded hash/nonce; do not manually free funds or create a second payment. Recovery by transaction replacement requires a separately reviewed operational change, not a blind retry. Finalized reverts release exactly once and the player may submit a **new** withdrawal request/key.

## Phase 3 integration checklist

- Build admin screens on the protected APIs; replace Phase 1 demo gateway only after connecting existing authenticated transport. No production UI is silently switched in Phase 2.
- Convert the old `pending_review` UI label from server `pending`; server `approved` already means reward credited (do not count it again as pending). Retain approved history permanently; no repeat/complete submission endpoint is needed.
- Distinguish withdrawal pending/authorized/prepared/broadcast/paid/rejected/failed. A requested/authorized payment is **not** a completed USDC payout. Link hashes to `https://basescan.org/tx/<hash>`.
- Use server balances, load real empty/loading/error states, require a fresh explicit destination confirmation, retain idempotency keys through retries, and paginate history. Never migrate demo/localStorage balances into the ledger.
- The `payoutsEnabled` flag reports server configuration, not treasury solvency or a guarantee of immediate payout. Retain truthful availability/error messages.
- Before enabling real funds: provision replica-set DB/unique indexes, review campaign funding and operating procedures, secure the dedicated signer, check RPC finality support, and perform a separately authorized small live payout. Automated tests never send mainnet funds.

Run `npm test` for the existing regressions and the isolated bounty workflow, concurrency, rollback, authorization, receipt verification and failure tests. No real social platform verification or real-funds payout is performed by tests.

On Windows, `node scripts/prepare-windows-test-mongo.mjs` optionally downloads just the official MongoDB 7.0.24 executable using byte ranges and checks the ZIP entry CRC/size (Node 24). Tests automatically use this ignored `.cache/test-mongodb/mongod.exe` if present. MongoDB also needs Microsoft's x64 Visual C++ runtime; install it through your normal trusted system setup or supply trusted app-local runtime DLLs. The test helper does not install system software. Linux CI uses MongoMemoryServer's normal official binary download. Compatible backend dependency patches and the patched Zod 4 validator are included; authentication regressions must run after dependency changes.
