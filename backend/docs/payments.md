# Bachs store integration

## Deployment configuration

Backend/Render only: `BACHS_API_KEY` (sandbox `sk_sandbox_...` first),
`BACHS_WEBHOOK_SECRET` (the matching sandbox webhook destination), existing
`MONGODB_URI` (replica set/Atlas), existing authentication/admin variables and
`SIWE_URI=https://rivals-heist.vercel.app`. The trusted HTTPS frontend origin
supplies checkout return URLs. The legacy `API_KEY` is accepted only when it has
a Bachs key prefix. Never set either key with a `VITE_` prefix. Checkout is disabled
without both Bachs settings; existing authentication/gameplay can still boot.

The website and Android use the existing authenticated first-party transport.
Vercel's existing `VITE_API_URL` must still point to the Render backend. The
payment allowlist does not proxy webhooks or arbitrary charge/fulfillment APIs.
Android requires a newly built APK for the native payment allowlist change.

Register `POST https://robina-1.onrender.com/api/payments/bachs/webhook` and the
events documented in [bachs-webhook.md](bachs-webhook.md).

## What is enabled

Six permanent weapons (MP5 $3, AK-47 $5, M4A1 $7, SCAR-H $10, M249 $15,
Elite Tactical Rifle $20), grenade packs (10/$3, 20/$5, 100/$10), and $2 instant
death recovery. All requested character/finish/emote/effect/bundle/founder/pass
prices are in the server catalog but those products are explicitly **unavailable**:
they are still studio previews or lack a released season/claim system. No money
can be taken for them. Enabling a catalog flag without implementing its
fulfillment deliberately fails closed. This is not a claim that those gameplay
features have been implemented.

Weapons equip into the primary existing slot for the next mission. Pistol,
knife, free rifle, pickups, input, AI, city and cameras remain available.
The authoritative simulation and remote presentation use the purchased weapon's
shared tuning and actual supplied collection model. Checkpoints retain the paid
controller, ammo and collection ID; revocation removes paid tuning on reconnect
and during periodic authoritative inventory refresh.

Account inventory is lazy-created with five starter grenades once per environment.
Loading the store, logging in or switching devices never increments that grant.
Grenade intent is durably debited before the server accepts a throw. Client
snapshots cannot replenish it. A disconnect/crash after reservation does not
refund the already accepted intent. Legitimate field pickups use their own
session/pickup-keyed ledger grant. A refill becomes visible in a live mission at
the next periodic inventory refresh (up to five seconds).

Death and two-hour recovery remain server-owned. First-aid remains +25 HP for
living players only. Recovery orders bind the current death number and deadline;
verified payment clears that exact active cooldown and the next deployment starts
with 100 HP. It does not resurrect an old completed mission. Payment after free
recovery or another death is retained as `review` with an explicit refund-required
reason. Never clear a different death or silently consume an obsolete recovery.

## Order integrity

Prices and grants are immutable order snapshots, in integer USD cents. Provider
money is decimal strings; comparisons use bounded BigInt-scaled decimals.
Bachs resolves local billing currency. The API verifies the exact USD base price
and the linked provider-confirmed billing charge; it does not guess exchange rates.
The genuine sandbox NGN payment retained `billing_currency: USD` on its checkout,
so that selection hint is not used as proof of the collected currency. The actual
currency and exact amount must match both independently retrieved charge objects.
The fixed cart price is supplied by the backend, even if a Bachs product is edited.

Client confirmation creates a unique `(player, idempotency key)` order and
permanent-item purchase lock. A cross-process lease protects initialization.
Products are cached by environment/catalog/SKU/price; uncertain product writes
are looked up by metadata before any retry. An uncertain checkout write is never
blindly repeated: recover its original reference from provider records or use
the owner's original-checkout reconciliation form. Bachs caches successful
idempotency responses for only 24 hours; a stable key alone is not proof that a
repeated uncertain write is safe.

A successful redirect, postMessage, browser receipt, screenshot or local storage
cannot mark an order paid. Server provider reads must match checkout ID, order
reference, player metadata, environment, exact price/currency, payment ID/status
and linked checkout. Free/unpaid completed checkouts grant nothing. Payments in
accepted/underpaid/overpaid or unknown states need reconciliation, not an automatic
grant. A unique charge index prevents reuse across orders.

Verified payment is durably recorded as `paid` before delivery. Inventory,
once-only grant ledger, recovery entitlement and `fulfilled` transition commit
in one majority-journaled transaction. If delivery fails, the paid order remains
retryable without another checkout. A duplicate webhook retries processing;
unique receipts and grant keys plus transactional order updates prevent double grants.

Refund/dispute events flag the order and freeze new spending for reconciliation.
Provider-confirmed full refunds revoke the weapon and its equipped selection.
Consumed grenades/recovery are not blindly subtracted or undone. Partial refunds
and disputes remain explicit review cases; resolve the financial case in Bachs,
not by inventing an app-side refund or a manual Paid flag. Payment-account freezes
are intentionally not auto-cleared by a later success event.

Sandbox ownership/history and live ownership/history are separate. Switching
to a live key does not convert test purchases into production inventory/revenue.

## APIs and screens

Player: `GET /api/payments/store`, `POST /api/payments/checkout` (`{sku}` plus
`Idempotency-Key`), `GET /api/payments/orders/:id`,
`POST /api/payments/orders/:id/check` (`{}`), `PUT /api/payments/equipment`
(`{sku}` or `{sku:null}`). Existing cookie auth, active-account checks, durable
rate limits, trusted-origin and payment CSRF header protections apply.

Owner: standalone `/admin/payments`, linked from bounty administration. APIs:
`GET /api/admin/payments/orders` (status/before pagination and per-environment
summaries), `POST /api/admin/payments/orders/:id/reconcile` and
`POST /api/admin/payments/orders/:id/attach-checkout` (`{checkoutId}`). The latter
only looks up the original checkout: independent Bachs verification still applies.
Reconciliation attempts and all grants/reversals have immutable ledger records.
There is no manual-paid or client-grant endpoint.

The existing store, inventory, recovery and purchase-history screens use real
account records. Confirmation uses Bachs only. Orders and opaque retry keys—not
balances, ownership, auth tokens or keys—may be remembered in sessionStorage.
Refreshing/reopening checks the same saved order. An unresolved response says
unconfirmed, never successful. Purchase history can reopen an order on another
device. Android opens secure Bachs checkout in the system browser. The verified
HTTPS payment-return App Link wakes the app and checks its saved order; an
unauthenticated browser sees a return-to-app/sign-in notice, not a false success.
Closing the browser and returning manually also checks the original order. The
native session is never exposed to that browser. App Links require the updated
installed APK and the existing release-signature association on the official domain.

## Tests / release gates

`npm run build:missions`, `node --test --test-concurrency=1` use isolated local
MongoDB fixtures, fake provider payments and real SDK signature checks. They
never connect to the developer database or send real money.

Opt-in actual sandbox check:

```sh
node scripts/bachs-sandbox-smoke.mjs --create-checkout
node scripts/bachs-sandbox-smoke.mjs --create-checkout --complete-bank-transfer
```

It refuses live keys and uses an ephemeral local DB. It does create sandbox
products/checkouts; those remain visible in the merchant's sandbox. No production
accounts, balances, orders or real card details are used. Browser completion
requires local Playwright/Chrome and a functioning Bachs sandbox page.

Verification performed during implementation: genuine sandbox checkout, USD/NGN
billing, a successful simulated bank-transfer charge, SDK payment verification,
MP5 ownership in the original isolated order database, and a second verification
leaving exactly one grant. The separate USD card attempt stayed `requires_action`
and correctly granted nothing; completed card authentication still needs a device
check. The test database was ephemeral; no production account received test items.

Before accepting real payments: deploy matching frontend/backend and new Android
build; configure the matching Bachs destination and observe a genuine successful
webhook delivery; perform a full device checkout/return; resolve merchant approval
and supported payment methods; test an authorized low-value live purchase and
refund manually. Sandbox and automated tests are not proof of production merchant
approval, device installation, genuine webhook delivery or a real-money live charge.
