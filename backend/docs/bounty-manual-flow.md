# Bounties: owner-reviewed rewards and externally paid withdrawals

This is the current production workflow. It supersedes the budget/automatic-treasury portions of the Phase 2 and Phase 3 documents. Authentication, Mongo transactions, exact micro-unit accounting, privacy, rate limits, notification delivery, server pagination and duplicate controls are retained. There is no production demo fallback.

## Owner workflow

1. Open `/admin/login`, then the standalone `/admin/bounties` page.
2. Create a bounty brief and publish it. Every authenticated RIVALS player can see an active, in-schedule bounty. There is no budget or participant cap. Draft/paused/closed/out-of-schedule briefs do not accept new submissions.
3. Players submit one original post URL per bounty. Their records immediately show Pending Review; no money is credited yet. New bounties explicitly say their reward amount is set after review, not a fictitious guaranteed amount.
4. Review the link/evidence, record your checks and enter **Amount to credit (USDC)**. Approval atomically credits that exact amount once, stores the awarded amount, appends the ledger/audit and notifies the player. Retrying with a different amount cannot change a final credit. Rejection records a visible reason.
5. The player requests at least 5 USDC to their Base address. The amount moves from available to reserved atomically; it cannot be spent or withdrawn twice. The admin withdrawal queue shows the player, requested amount, fixed destination and current available/reserved balances.
6. Copy the request's Base address and pay the exact native-USDC amount yourself from your Base wallet. The app never opens/signs with your wallet, takes a key or sends money. Wait for your wallet to report success; if payment is uncertain, do not send again or mark paid.
7. Return to the request, confirm that you personally paid and click **Mark Paid & Notify Player**. A transaction hash is recommended, not required. Notes and any supplied reference are retained for audit. A supplied hash is format-checked and unique across requests, but it is NOT automatically verified as a payment.
8. Mark Paid settles reserved funds into total withdrawn once and creates a notification telling the player to open their Base wallet to confirm receipt. The player sees **Paid / administrator confirmed**, not a claim of automatic/on-chain verification.

Mark Paid cannot prove that an external payment happened or prevent an owner from sending twice in an external wallet. Use the fixed request ID, hash and wallet history to check before paying. Never mark a pending/failed external transfer paid. There is no automatic retry, refund of a paid request, arbitrary balance editor or second credit button.

## APIs

- Task input: title, platform, description, instructions, disclosure, minimumEngagement, evidenceRequired, optional startsAt/expiresAt. Old budget/reward/cap input fields are rejected. `rewardMode: manual` and zero unknown reward are server-generated; the UI labels them as unset, not a zero-dollar reward.
- Approve submission: existing manual verification fields plus positive exact `rewardMicros` (decimal integer string, six decimal places). The result stores `awardedMicros`; immutable submission terms remain separate.
- `POST /api/admin/bounties/withdrawals/:id/paid`: `{confirmed:true, txHash?, notes?, acknowledgeRisk?}`. Existing owner cookie, trusted write origin, JSON, `X-Rivals-Bounty: 1` and admin rate limits are required.
- The old `/execute` route always returns 410 `automatic_payouts_retired`, even if old payout-enable/key settings exist. No new public API signs or broadcasts transactions.
- Player wallet reports `payoutMode: manual`, request availability and server-counted pending submissions. Treasury configuration does not gate manual requests.
- The optional read-only `/reconcile` endpoint exists exclusively for already signed legacy requests; it cannot create/send a payment.

## Existing records and deployment

Startup migrates only **future task terms** to manual rewards, removes their participant cap and increments their revision, in transactional batches with audit records. It does not rewrite submitted terms, awarded rewards, balances, withdrawals or immutable ledger rows. Old cached briefs fail the revision check. Older pending submissions retain any previously advertised fixed reward as a minimum; already credited amounts are not recalculated. An existing signed/prepared/broadcast withdrawal cannot be manually marked paid or rejected/refunded: reconcile its existing transaction first.

No new Render environment values are required. Do not give the backend your Base wallet private key. The optional old `BOUNTY_BASE_RPC_URL` is used only for read-only recovery of pre-existing signed transfers; old payout/key/gas variables do not enable automatic payments. The normal transaction-capable Mongo deployment and existing login credentials remain required. See [the current commented template](../.env.example).

Deploy the matching backend and frontend and install the newly signed Android APK; bundled Android frontend changes are not installed by a website deployment alone. Old application versions should be updated. Physical-device and real-wallet payment checks remain operator responsibilities; automated tests use isolated data and never send funds.

## Verification

Backend tests cover manually chosen different reward amounts, once-only concurrent approval/payment, conflicting retries, duplicate transaction references, rollback, authorization/CSRF, reservation rejection/release, unlimited participation, legacy promised rewards and legacy signed-intent protection. Browser tests exercise publish → player submission → admin-entered reward → withdrawal → admin payment confirmation → player notification, with no blockchain client or real transfer.
