# Bounty & Earn — Phase 1

Entry point: **BOUNTY & EARN** in the authenticated lobby and game navigation, route `/bounties`.

## What is implemented

- Responsive creator-contract board with X (10 USDC / 5,000 impressions) and TikTok (5 USDC / 5,000 views) example campaigns.
- Accessible, focus-trapped task brief and submission dialog with promotional-disclosure instructions, canonical platform-post URL validation, HTTPS engagement-evidence link, optional notes and explicit confirmation.
- Immediate Pending Review state, submission archive, all four review states, rejection reasons, dated links, filters and non-repeatable contracts (including rejected and completed contracts).
- Separate USDC dashboard: available, earned, pending and withdrawn, Base destination field, minimum 5 USDC, confirmation dialog, insufficient-balance/pending-request locks and withdrawal history.
- Six notification presentations: published, received, approved, rejected, credited and withdrawal updates. Read state persists.
- Loading, empty, retry, validation-error, save-error and blocked-storage presentations.

## Deliberate Phase 1 boundaries

This is an **interactive device-local demo**, not a live funded bounty program. The page labels this explicitly. Both example campaigns are temporary fixtures, not actual administrator publications. New profiles start with **zero** available, earned and withdrawn USDC. A submission never credits a reward or automatically passes review. Review outcomes and funded wallets are exercised with test fixtures only, not fabricated in players' accounts.

There are no backend endpoints, actual evidence uploads, engagement checks, review jobs, wallet connections, signatures, payment processing or chain transactions. The manual address field validates a non-zero EVM address's shape only, not ownership, checksum or chain membership. Evidence is an external HTTPS screenshot link plus optional notes. Users are warned not to expose private account data or seed phrases.

Demo state is namespaced by the existing authenticated `baseUser.wallet` identity and versioned separately from game dossiers and account balances. It persists in localStorage on this device only, not between website and Android installations. Blocked, full or corrupt storage produces a visible session-only warning. Clearing storage also clears this simulation; local duplicate prevention is **not a security boundary**.

## Phase 2 integration seam

`src/features/rivals/bounties/model.ts` defines `BountyGateway`, typed tasks, submissions, notifications, withdrawal requests and snapshots. `BountyPage` accepts a gateway; its default factory is `createDemoGateway(identity)`. View components consume the snapshot, not imported fixture arrays. Temporary content lives in `demoData.ts`; only the demo adapter imports it.

Implement a separately reviewed, authenticated HTTP gateway for:

| Method | Responsibility |
| --- | --- |
| `load(signal)` | Fetch the published task catalog, current player's archive, wallet summary, notifications and withdrawal history. Honour cancellation. |
| `submit(input)` | Revalidate eligibility, disclosure/evidence and task requirements. Enforce an atomic unique player/task constraint and idempotency. Return a refreshed snapshot. |
| `saveAddress(address)` | Validate destination and securely save the authenticated player's chosen Base address. |
| `requestWithdrawal(input)` | Revalidate minimum, available balance, destination and pending requests atomically. Reserve funds server-side. Return a refreshed snapshot. |
| `markNotificationsRead()` | Persist read markers and return refreshed notifications. |

No endpoint paths are invented or called in Phase 1. Do not send player identity supplied by a browser as authorization; derive it from the existing verified session. Do not import demo balances or local records into a real ledger. Before activating a live adapter, introduce an explicit live-mode snapshot contract and replace demo-specific messaging/confirmation wording throughout the page and wallet. The current `mode: 'demo'` type deliberately prevents an accidental silent switch to real transfers.

All amounts use safe integer **micro-USDC** (`1 USDC = 1,000,000` units), never floating-point monetary arithmetic. Server responses must be validated at the HTTP boundary. Preserve submitted task title/reward snapshots so completed records survive catalog changes. Keep `approved` (awaiting credit) distinct from `completed` (credited); pending rewards are not available funds. Withdrawal `requested`/`processing` reserves simulated available funds but does not increment withdrawn totals; only a confirmed future payment should do so.

The server must own publication, deadlines, participation rules, review decisions/reasons, anti-fraud checks, notification events, verified rewards and wallet accounting. Replacing the gateway does not implement those systems. Production pagination, evidence access controls and support policies belong in Phase 2.

## Verification

- `src/features/rivals/bounties/model.test.ts`: URLs, disclosure consent, evidence, monetary precision, address shape and pending totals.
- `demoGateway.test.ts`: persistence/account isolation, all non-repeatable review states, concurrent submits, no reward credit, blocked storage and simulated withdrawal guards.
- `BountyPage.test.tsx`: actual forms, all statuses/notification variants, loading/empty/error recovery, focus restoration, retry, identity isolation and funded-wallet test fixtures.
- `GameHub.test.tsx`: navigation integration without loading gameplay or making API calls.
- `tests/command/bounties.spec.ts`: real Chrome submission/persistence flows, no API writes, desktop/phone/landscape geometry and Escape handling (also used by Capacitor's native Back bridge).

No gameplay, authentication, payment services or native lifecycle handlers are changed. Physical Android-device testing remains a release check; browser viewport checks and Capacitor package validation do not replace it.

### Local verification — 2026-11-11

- Final clean regression: **67 files, 435 tests passed** (`vitest run --maxWorkers 2 --testTimeout 15000`).
- TypeScript application and tooling checks passed; targeted ESLint and tracked-diff whitespace checks passed.
- Vite production bundle generated successfully. Bounty page: 28.52 kB JavaScript / 9.29 kB gzip; 15.47 kB CSS / 4.08 kB gzip. Existing vendor annotation/chunk-size warnings remain.
- **4 production-bundle Chrome tests passed**: bounty layouts and dialog focus, phone submission/persistence, existing lobby/player/store routes, and existing mobile/landscape dialogs. Viewports include 1440×1000, 1366×768, 1024×768, 390×844, 320×568 and 844×390.
- Capacitor Android sync and existing package verification passed. Both packaged `BountyPage` JavaScript and CSS also matched their `dist/assets` SHA-256 hashes exactly.
- No API writes were observed in the browser scenarios. No push, deployment, APK build/publication or physical-device test was performed for this frontend phase.
