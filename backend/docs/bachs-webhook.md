# Bachs webhook and verified payment fulfillment

Route: `POST /api/payments/bachs/webhook`.

After deploying the backend, register this destination in Bachs:

```text
https://robina-1.onrender.com/api/payments/bachs/webhook
```

Subscribe to `collection.succeeded`, `collection.failed`, `checkout.completed`,
`checkout.expired`, `refund.created`, `refund.paid`, `refund.failed`,
`dispute.created` and `dispute.updated`.
Set `BACHS_WEBHOOK_SECRET` in the backend/Render environment to this endpoint's
signing secret, not an API key. Set `BACHS_API_KEY` for checkout and provider-side
verification. Neither belongs in the frontend. Without the signing secret,
the webhook fails closed with 503; existing authentication/gameplay still boot.

The official `@bachs/sdk` verifies untouched raw bytes and the delivery timestamp
before parsing JSON (default 300-second tolerance). Both V2 and SDK-supported
legacy headers work; malformed V2 cannot fall back to legacy. Duplicate HTTP
signature headers, compressed bodies, non-JSON content and oversized bodies
(64 KiB maximum) are rejected. This provider route bypasses browser CORS/CSRF,
not signature verification; other API security gates remain unchanged.

Verified events are acknowledged only after a majority/journaled MongoDB insert
into `bachswebhookevents`. The event ID is the unique `_id`; concurrent requests,
other instances and restarts cannot create a second receipt. A matching retry
retries independent, idempotent order processing without changing the original receipt. Reuse of the same ID with a
different event type/organization gets 409. Duplicate lookup uses a majority
read so a still-uncommitted/uncertain first insert is not acknowledged. Storage outages return 503 so
Bachs can retry; an uncertain write is safely resolved by the same unique ID.
Unknown verified event types are stored as ignored and acknowledged with 200.

Only event ID, type, organization ID, classification, first-received timestamp,
raw-body SHA-256 and `purpose: receipt_only` are stored. No payloads, customer
details, banking data, secrets or signature headers are persisted. Delivery logs
contain a generated reference, hashed event reference, allowlisted event type,
result, HTTP status and duration; they never print payloads or exception text.
Retain receipt IDs when operating this endpoint; deleting them loses durable
deduplication. Fulfillment is tracked independently in store orders and the immutable
store ledger. Historical receipt-only events do not grant arbitrary products.

**An acknowledged receipt is not proof of fulfillment.** For a linked order the
handler independently fetches the checkout and payment using the official SDK,
checks ownership/reference/environment/base price/billing currency and actual
payment status, then fulfills transactionally. `checkout.completed` alone never
grants anything. The provider is paid only through its hosted checkout; this
handler never charges a card, sends bounty USDC or executes a withdrawal.

See [payment integration and release checklist](payments.md).

Tests (isolated MongoDB; locally generated test signatures; no real payments):

```sh
node --test test/bachsWebhook.test.js
npm test
```

The Bachs dashboard/CLI delivery still needs a smoke test after deployment with
your actual destination secret. No live Bachs delivery is simulated as real here.

References: [official SDK](https://docs.bachs.io/sdks/node),
[webhook setup and event names](https://docs.bachs.io/guides/webhooks/overview).
