# Standalone Bounty Command — Phase 3

**Updated workflow:** See [manual rewards and external owner payments](bounty-manual-flow.md). The standalone entry and security remain; campaign budgets/caps and automatic sending below are superseded. The current browser fixture has no chain client and no payment processing.

## Entry and separation

Owner entry is `/admin/login`. Successful existing owner authentication now opens **`/admin/bounties`** directly. This is a standalone application surface, not a section of an existing dashboard. No dashboard route, sidebar item, public player-menu admin link, or new authentication system was added. Anonymous visitors and ordinary players are redirected to the existing owner login; the backend independently enforces the owner cookie and revocation checks on every administrative request.

The standalone sections are:

- `/admin/bounties`: real operation totals and review/payout queues.
- `/admin/bounties/campaigns`: create drafts, edit terms, schedule, publish, pause and close.
- `/admin/bounties/submissions`: searchable status-filtered manual review queue.
- `/admin/bounties/players`: searchable earnings, activity flags and paginated account history.
- `/admin/bounties/withdrawals`: authorization, unsigned cancellation, payout execution and reconciliation.
- `/admin/bounties/audit`: append-only administrative history with expandable details.

Old retired dashboard links still use the existing redirects. Gameplay, store and local campaign-economy modules have not been replaced or moved into the bounty ledger.

## Real player integration

The player `/bounties` screens now default to `createApiGateway`, not `createDemoGateway`. All tasks, submissions, balances, withdrawals, notifications and ledger entries come from authenticated server APIs. Real empty/error states never fall back to fabricated contracts, activity or balances. Legacy mock modules remain only as explicitly injected automated-test fixtures and are not imported by the production page or live gateway. Device-local simulated USDC is never migrated into server accounts.

`pending` backend submissions are shown as **Pending Review**. Backend `approved` means the reward was credited atomically, so the player sees **Completed**, not another credit-pending reward. Rejected reasons remain visible and no submission can repeat. Active task responses include the current player's participation independently of history pagination: even an older completed submission keeps the contract locked.

The wallet shows server-held available, pending, reserved, lifetime earned and withdrawn amounts. All wire amounts are decimal strings of integer USDC micro-units. The existing player view consumes only bounded, exactly representable integers; money formatting splits integer whole/fractional units without floating-point division. Admin displays format wire strings using BigInt directly.

Withdrawal state is not collapsed to Paid. Requested/pending, authorized, prepared, broadcast, verified paid, rejected, and finalized-revert states remain distinguishable. Transaction hashes link to BaseScan but a hash alone never makes a payment Paid. Payout requests are unavailable in the player UI when the server reports treasury payouts disabled.

Withdrawal retry keys are account-scoped and retained in session storage through interrupted responses, refresh failures and gateway recreation. No session tokens, private keys or balances are stored there. A previously accepted request has its own `requestKey` in private withdrawal history; retrying preserves the original key and payload. A background refresh cannot clear the key while an uncertain dialog may still retry. Only a confirmed request plus successful refresh completes the intent. A changed amount/destination is blocked while the original request is uncertain: check history, then retry the original details to confirm the same request before starting another. Acceptance and failure-to-refresh are reported separately so the player is not told an accepted withdrawal failed to exist.

Both player and admin refresh every 15 seconds and on window focus. No existing Socket.IO service was present, so no Redis, queue, websocket dependency or unnecessary background infrastructure was introduced. A completed admin action invalidates its operational queries immediately; another player's open page receives the change on its next refresh. History uses server cursors with explicit Load More / Next / Previous controls, not fictional global totals or client-side slicing of a partial server page.

## Campaigns and review

X and TikTok presets prefill the **form only** (5,000 reach, 10/5 USDC). They do not create or publish records automatically. Saving creates a draft; publishing requires a separate acknowledgment of funding, terms and disclosure requirements. A budget caps promises but is not a treasury deposit.

Start and expiration dates are optional, entered in the operator's local timezone, sent/stored as UTC, and enforced in player list/detail/submit APIs. Only active, in-schedule campaigns are available to players. Editing an expired campaign's schedule cannot rewrite existing submission terms. Reopening a closed campaign is not allowed. The live player submission includes the brief's terms revision; if that brief changed while the dialog was open, the server refuses submission until the player reviews the new terms.

The reviewer sees the original URL, external supporting evidence, player-supplied notes labeled unverified, the exact promised revision/reward, disclosure requirements and activity indicators. Approval requires independent verified reach at/above the promised threshold, four explicit ownership/engagement/compliance/disclosure checks and a verification record. Flagged risk requires separate acknowledgment. Rejection requires a player-visible reason. An already approved record is read-only and cannot offer another credit button.

External evidence is opened only in a new tab with `noopener noreferrer`. It is not fetched by Express, rendered as trusted HTML, automatically embedded, or accepted as proof by itself. There is no automatic X/TikTok analytics verification integration; operators must use an authorized independent review process. Network sharing, duplicate email records and reused payout addresses are indicators, not proof of fraud. Proxy networks can be shared legitimately; configure the existing reverse proxy trust boundary correctly and review these flags accordingly.

Player labels use the existing account's email-local-part or shortened wallet; no invented username is created and authentication records are not rewritten. Admin financial history is read-only; there is no arbitrary balance-edit control.

## Payout operation

The underlying [Phase 2 financial controls](bounty-phase-2.md) remain authoritative. Admin authorization and actual treasury execution are deliberately separate confirmations:

1. Review the source, destination, amount, account and risk indicators; authorize or reject.
2. Reopen an authorized request and explicitly confirm the **real native-USDC transfer on Base**.
3. Use Send to invoke the existing durable signed-intent flow.
4. For prepared/broadcast requests, use Check Verified On-Chain Status. The optional rebroadcast control sends only the same persisted transaction bytes, never a new nonce/payment.
5. Only a verified finalized receipt updates the status to Paid. Uncertain RPC results keep funds reserved. A finalized revert returns reserved funds exactly once.

A still-unsigned authorized request may be cancelled with a reason; a concurrent preparation makes cancellation fail safely instead of releasing signed funds. There is no force-paid button, replacement-hash field, nonce-reset control or refund-uncertain-payment action. Backend error messages are converted to actionable UI copy, never raw treasury keys or RPC credentials.

## First-party transport and Android

The three existing owner session URLs (`/api/admin/me`, `/api/admin/login`, `/api/admin/logout`) use exact rewrites to `api/admin-session.js`. This consolidates three transport-only wrappers into one while retaining the same backend authentication, methods, cookie filtering, same-origin protections and public URLs. Player authentication entry points are unchanged. The application now has 11 API entry files rather than adding a thirteenth function to the existing Hobby deployment. Both shared relays have a 30-second function allowance around their bounded 25-second upstream timeout.

The existing Vercel HttpOnly-cookie relay now explicitly allowlists bounty methods/routes via `server/bountyPolicy.js`. Explicit `vercel.json` rewrites send `/api/bounties/*` and `/api/admin/bounties/*` to the single `api/bounty-relay.js` function. This follows [Vercel's shared Node-function routing guidance](https://vercel.com/docs/functions/runtimes/node-js), rather than assuming Next.js catch-all filename semantics in a Vite application. The wrapper accepts original or rewritten request URLs, strips its reserved routing parameter, and refuses unrelated paths; it is not an open backend proxy. POST/PUT/PATCH require JSON, the bounty CSRF header, trusted same-origin writes and the existing cookie checks. Withdrawal idempotency keys are forwarded unchanged. Redirects/HTML upstream responses remain rejected and private responses are not cached. No backend private key or treasury service is imported into the frontend; the backend `.d.ts` import is types-only.

The Android native cookie owner now allows only the listed **player** bounty endpoints and bounded pagination queries. It forwards the stable withdrawal key and custom CSRF header and supports the address PUT operation. Admin routes, payout authorization/execution, arbitrary URLs, path traversal, unknown query parameters and unrelated payment APIs remain blocked. The bounded response allowance is larger for paginated bounty records; auth response limits remain unchanged. Owner administration remains a website-only operation in the existing native auth provider.

**A new Android APK must be built and installed**: updating the website alone does not upgrade the native bridge Java code. Use the existing signed Android CI workflow for release packaging. Physical-device testing and a full signed Android build still require the configured Android SDK/signing environment; browser landscape checks and JVM policy probes are not a substitute for a physical-device test.

## Deployment and live verification

This implementation does not deploy automatically, publish funded campaigns, install an APK, provision private keys, or send mainnet funds. Deploy the matching Express backend and web frontend together before expecting the live UI to work; deploying only the frontend against an auth-only backend will show real API errors, not demo data.

1. Keep existing `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, auth/cookie/CORS, and frontend `VITE_API_URL` configuration. No new owner credentials or auth storage are introduced.
2. Ensure the existing Mongo deployment supports transactions and required indexes, as checked at startup.
3. Keep `BOUNTY_PAYOUTS_ENABLED=false` until the backend-only dedicated treasury address/key, trusted Base RPC, ETH gas and native-USDC funding are configured and reviewed. Never put secrets under `VITE_*` or send them to the frontend.
4. Use the existing [Phase 2 treasury configuration and recovery guide](bounty-phase-2.md), including exclusive signer ownership, per-transfer and gas caps, unresolved-intent reconciliation and database access controls.
5. Publish a reviewed campaign through the standalone page. Verify visibility from a separate real player account, review eligibility and credit exactly once.
6. After a separately authorized small real-wallet payout, confirm canonical finalized Base settlement, the ledger and wallet changes, and the linked transaction. Automated tests intentionally simulate chain activity and never send mainnet funds.
7. Release/install the rebuilt Android APK and verify session restoration, submissions, address saving, request retry and withdrawal history on a physical device.

## Reproducible verification

```text
backend: npm test
frontend: npm run typecheck
frontend: npm test -- --maxWorkers 1
frontend: npx playwright test --config playwright.bounties.config.ts
frontend: npm run build
frontend: npx cap sync android
frontend: npm run android:verify
```

The browser configuration creates temporary local servers, a real disposable Mongo replica set and a deterministic simulated Base RPC, and uses the real owner login/player pages/Express APIs. Its test-only bootstrap script refuses to run outside explicit `NODE_ENV=test` plus `RIVALS_BOUNTY_BROWSER_QA=1`; it is not mounted or imported by the production server. Test database reset is restricted to the explicitly named disposable test database. The simulated treasury still exercises production signing, durable reservation and finalized-receipt verification code without any live RPC or real funds.

Desktop, 390px/320px phone and short-landscape screenshots are generated under ignored `robina/test-results/bounties`. Unit tests cover strict admin-route separation, review confirmations, rejection reasons, no repeated credit UI, payout-disabled controls, unresolved-vs-Paid status, exact unit formatting, server-only state, stable retry keys and native transport restrictions. Backend tests cover real Mongo transactions, rollback, concurrent credit/reservation, duplicate prevention, metrics, literal search, pagination, scheduling and stale terms.
