# RIVALS: RIVAL HEIST
## MASTER CODEX PROMPT 19 OF 22
### COMPLETE MONETIZATION ENGINE, PAYSTACK INTEGRATION, COSMETIC ECONOMY, PREMIUM SEASON PASS, MEMBERSHIPS AND REVENUE ANALYTICS

## YOUR ROLE

You are a senior full-stack game engineer, game economy architect, monetization strategist, payment integration specialist, Node.js/Express developer, MongoDB engineer, React/TypeScript developer, Phaser engineer and application security specialist.

You are continuing development of the existing RIVALS: RIVAL HEIST project.

RIVALS is a cinematic, lightweight, competitive, top-down 2D/2.5D action-heist browser game.

The game contains:

- Missions and expeditions.
- Player combat.
- Intelligent enemies.
- Security systems.
- Vault raids.
- Player-created vaults.
- Rival challenges.
- Ghost replays.
- Competitive leaderboards.
- Player progression.
- Character customization.
- Seasonal progression.

Your mission is to build a **complete, functional and sustainable monetization system** around these existing gameplay mechanics.

The game must remain free-to-play.

Monetization must be optional and competitively fair.

Do not start another project.

Do not redesign unrelated gameplay systems.

Do not deliver decorative payment buttons or fake purchase flows.

Implement working backend services, frontend interfaces, database persistence, ownership verification and payment security.

---

# SECTION 1 — CRITICAL PROJECT REQUIREMENTS

## 1.1 EXISTING PAYMENT SYSTEM

The previous payment infrastructure uses USDC on the Base blockchain.

PAYSTACK IS NOT INTEGRATED.

Do not assume a Paystack implementation exists.

Your responsibilities:

1. Inspect the existing payment architecture.
2. Identify dependencies on the old USDC checkout.
3. Implement Paystack from scratch.
4. Make Paystack the primary payment provider for new RIVALS purchases.
5. Remove obsolete USDC checkout interfaces from the new store.
6. Keep historical payment records intact.
7. Preserve legitimate existing purchases and entitlements.
8. Do not damage authentication or wallet-account connections that remain necessary.
9. Do not activate real transactions without verified merchant configuration.
10. Keep any future cryptocurrency payment integration optional and separate.

Do not invent payment credentials or smart contracts.

## 1.2 REMOVE OLD MINING AND CLAIM GAMEPLAY

RIVALS must not contain the old mining or claim mechanics.

Inspect the frontend and backend.

Remove obsolete:

- Mining pages.
- Mining dashboards.
- Mining buttons.
- Mining timers.
- Mining animations.
- Mining reward panels.
- Mining-specific notifications.
- Mining navigation.
- Mining claim buttons.
- Mining-related gameplay API calls.
- Obsolete mining services.
- Unnecessary mining scheduled jobs.
- Old claim-related interface components.
- Obsolete mining state management.

Retire unused backend routes safely after confirming they have no remaining dependencies.

Do not destructively delete historical financial or entitlement records.

Do not introduce a new tap-to-earn or passive reward system.

All new gameplay progression must come from actual missions, raids, challenges, achievements and expeditions.

Eligible rewards should be delivered automatically.

---

# SECTION 2 — RIVALS REVENUE MODEL

Implement a free-to-play game supported by optional purchases.

Primary revenue sources:

1. Character skins.
2. Weapon skins.
3. Vault themes.
4. Vault decoration packs.
5. Emotes and victory effects.
6. Cosmetic bundles.
7. Premium Season Pass.
8. RIVALS Club membership.
9. Founder Supporter Pack.

Every revenue stream must have:

- Actual implemented products.
- Configurable pricing.
- Product previews.
- Purchase functionality.
- Backend payment verification.
- Persistent ownership.
- Inventory integration.
- Appropriate equipment or activation functionality.

Do not display purchasable products that cannot actually be delivered.

Do not sell gameplay advantages.

---

# SECTION 3 — CHARACTER SKIN MARKETPLACE

Build a premium character skin store.

Suggested initial products:

NEON ASSASSIN — $3.99

SHADOW RAIDER — $4.99

CYBER PHANTOM — $5.99

CRIMSON ROGUE — $5.99

GOLDEN HEIST — $7.99

MIDNIGHT OPERATOR — $7.99

These are proposed commercial prices.

Do not hardcode them as payment amounts.

All actual prices must come from the backend product catalog.

Create:

- Character skin categories.
- Animated previews.
- Skin detail screens.
- Skin ownership indicators.
- Purchase buttons.
- Equip/unequip.
- Persistent equipped appearance.
- Compatible character animations.
- Integration with missions and supported replays.

Reuse existing artwork where possible.

If separate skin assets are unavailable, create compatible color variations or lightweight cosmetic overlays using supported assets.

Do not invent missing sprite sheets.

Do not list unfinished skins as available for purchase.

Skins must not modify combat statistics or hitboxes.

---

# SECTION 4 — WEAPON SKIN MARKETPLACE

Implement premium cosmetic weapon customization.

Suggested products:

NEON PULSE — $2.49

SHADOW STEEL — $2.99

CRIMSON FIRE — $3.49

CYBER FROST — $3.99

GOLD PROTOCOL — $4.99

Requirements:

- Weapon cosmetic catalog.
- Product previews.
- Weapon compatibility rules.
- Purchase verification.
- Inventory ownership.
- Equip/unequip.
- Persistent appearance.
- Actual weapon-rendering integration.

Weapon cosmetics must never alter:

- Damage.
- Fire rate.
- Ammunition.
- Accuracy.
- Projectile speed.
- Reload speed.
- Hitboxes.

---

# SECTION 5 — VAULT ARCHITECT MONETIZATION

Vault customization is one of RIVALS' most valuable monetization opportunities.

Players must be able to create and publish functional vaults for free.

Premium purchases should customize vault appearance.

## Premium vault themes

NEON FORTRESS — $4.99

CYBER LABORATORY — $5.99

SHADOW BUNKER — $6.99

CRIMSON DISTRICT — $7.99

GOLDEN TREASURY — $9.99

## Vault decoration packs

NEON LIGHTING PACK — $3.99

CYBER WALL PACK — $3.99

LUXURY VAULT PACK — $5.99

FUTURISTIC ENVIRONMENT PACK — $6.99

## Vault entrance effects

ELECTRIC ENTRANCE — $2.49

SHADOW PORTAL — $2.99

GOLDEN VAULT REVEAL — $3.99

Implement:

- Theme marketplace.
- Visual previews.
- Vault Architect integration.
- Cosmetic object catalog.
- Purchased theme inventory.
- Theme application.
- Theme removal.
- Persistent selections.
- Published vault appearance compatibility.
- Ownership validation.

Paid vault decorations must not alter:

- Trap damage.
- Enemy health.
- Guard strength.
- Detection range.
- Collision.
- Defense budgets.
- Mandatory objectives.
- Security visibility fairness.

Separate decorative configuration from functional vault configuration.

---

# SECTION 6 — EMOTES AND VISUAL EFFECTS

Create purchasable cosmetic effects.

Categories:

- Victory animations.
- Character emotes.
- Entrance animations.
- Extraction effects.
- Movement trails.
- Profile effects.
- Cosmetic celebration effects.

Suggested products:

VICTORY THUNDER — $2.49

PHANTOM ENTRANCE — $2.99

NEON CELEBRATION — $2.99

SHADOW DISSOLVE — $3.49

GOLDEN EXTRACTION — $3.99

Implement:

- Preview.
- Ownership validation.
- Purchase.
- Equip/unequip.
- Gameplay integration.
- Animation compatibility.
- Reduced-effects fallback.
- Persistent loadout.

Effects must not obscure gameplay or offer advantages.

---

# SECTION 7 — COSMETIC BUNDLES

Build a dedicated bundle marketplace.

## STARTER RAIDER PACK — $7.99

Includes:

- One compatible character skin.
- One compatible weapon skin.
- One emote.

## SHADOW OPERATIVE BUNDLE — $9.99

Includes:

- Shadow character skin.
- Matching weapon skin.
- Movement effect.
- Profile badge.

## ELITE HEIST BUNDLE — $14.99

Includes:

- Premium character skin.
- Premium weapon cosmetic.
- Vault decoration pack.
- Victory effect.
- Profile decoration.

Implement:

- Bundle catalog.
- Product previews.
- Itemized bundle contents.
- Configurable price.
- Actual discount calculation.
- Ownership verification.
- Secure checkout.
- Atomic entitlement delivery where supported.
- Clear rules for already-owned items.

Only use real, implemented catalog products.

Do not fabricate discounts.

---

# SECTION 8 — PREMIUM SEASON PASS

Implement a complete Premium Season Pass.

Suggested duration:
8 weeks.

Suggested price:
$6.99 per season.

The Premium Season Pass is a one-time purchase per season.

Create two reward tracks.

## FREE TRACK

- Basic cosmetics.
- Profile badges.
- Free emotes.
- Seasonal decorations.
- Gameplay achievement recognition.

## PREMIUM TRACK

- Exclusive character skins.
- Premium weapon cosmetics.
- Special animations.
- Exclusive vault themes.
- Victory effects.
- Season profile decorations.

Build:

- Season overview.
- Season countdown.
- Tier progression.
- Free reward track.
- Premium reward track.
- Current tier.
- Completed tiers.
- Reward previews.
- Premium purchase flow.
- Payment verification.
- Premium entitlement activation.
- Automatic eligible reward delivery.
- Season expiration.
- Persistent cosmetic ownership.

Players must earn season progress through gameplay.

Do not introduce obsolete mining systems.

If a player purchases premium access after already completing several tiers, automatically deliver eligible previously earned premium rewards.

Prevent duplicate rewards.

Season Pass cosmetics must not provide competitive advantages.

---

# SECTION 9 — RIVALS CLUB MEMBERSHIP

Implement an optional premium membership.

Name:
RIVALS CLUB.

Suggested monthly price:
$3.99.

Benefits:

- Exclusive monthly cosmetic selection.
- Club profile badge.
- Premium profile border.
- Cosmetic lobby effects.
- Special character customization options.
- Member-only cosmetic collections.
- Optional cosmetic discounts.

Do not sell gameplay power.

## Membership billing

Investigate current Paystack subscription support.

Recurring billing must only be enabled when supported by the merchant account and payment method.

If recurring billing is available:

Implement:

- Subscription plan.
- Billing authorization.
- Membership activation.
- Renewal events.
- Subscription status.
- Failed renewal handling.
- Cancellation.
- Expiration.
- User-facing membership management.
- Secure subscription event processing.

Paystack's recurring subscription functionality supports eligible card payments and Nigerian Direct Debit, subject to merchant and payment-method availability.

If recurring billing is unavailable:

Implement a manually renewable 30-day membership.

Clearly show that renewal is manual.

Never advertise automatic billing when it is not implemented.

Never charge users without proper authorization.

---

# SECTION 10 — FOUNDER SUPPORTER PACK

Create a one-time Founder Supporter Pack.

Suggested price:
$9.99.

Possible contents:

- Founder badge.
- Founder-themed character appearance.
- Special profile border.
- Founder title.
- Exclusive victory animation.

All included items must exist before the pack can be purchased.

No combat advantages.

No misleading scarcity or fabricated purchase counts.

---

# SECTION 11 — COMPLETE IN-GAME STORE

Build a premium RIVALS Store.

Required categories:

- Featured.
- Character Skins.
- Weapon Skins.
- Vault Themes.
- Vault Decorations.
- Emotes.
- Effects.
- Bundles.
- Season Pass.
- RIVALS Club.
- Founder Pack.
- Purchase History.

Each product card must show:

- Product title.
- Product preview.
- Description.
- Category.
- Configured price.
- Supported currency.
- Availability.
- Ownership status.
- Purchase button.
- Equip action when owned.

Create:

- Product details.
- Search.
- Filters.
- Category navigation.
- Responsive layout.
- Loading states.
- Error states.
- Purchase confirmation.
- Payment status.
- Inventory synchronization.

Use the existing cinematic visual identity.

Do not preload the complete store during initial game startup.

---

# SECTION 12 — BUILD PAYSTACK FROM SCRATCH

IMPORTANT:

Paystack does not currently exist in this repository.

Build a new Paystack integration.

Use the official Paystack API documentation.

Implement:

1. Backend transaction initialization.
2. Hosted checkout or supported popup checkout.
3. Transaction verification.
4. Secure webhook processing.
5. Order persistence.
6. Entitlement fulfillment.
7. Payment history.
8. Refund reconciliation.
9. Subscription integration where supported.
10. Payment failure recovery.

Use the existing Node.js/Express backend and MongoDB database.

Do not expose the Paystack secret key.

Do not replace authentication.

---

# SECTION 13 — PAYSTACK CONFIGURATION

Create appropriate environment variables.

Suggested examples:

PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_CURRENCY=NGN
PAYSTACK_CALLBACK_URL=
PAYSTACK_TEST_MODE=true

Only retain variables genuinely required by the chosen implementation.

The Paystack public key is needed only for frontend integration modes that require it.

Keep the secret key exclusively on the backend.

Do not invent a separate webhook secret.

Webhook authenticity must be verified using Paystack's documented signing mechanism.

Create an environment example file without real credentials.

Document:

- Where to obtain test credentials.
- Where to obtain live credentials.
- Callback configuration.
- Webhook configuration.
- Currency configuration.
- Test-mode procedures.
- Production activation requirements.

Never commit secrets.

---

# SECTION 14 — MERCHANT ELIGIBILITY AND CURRENCIES

Before activating production checkout:

Verify:

- That the merchant account is approved.
- That the RIVALS product category is eligible.
- That the intended payment channels are enabled.
- That international payments are permitted.
- That the intended currencies are supported.
- That subscription payments are supported if needed.

Paystack may restrict online gaming or cryptocurrency-related businesses in some payment categories.

Do not assume approval.

Do not bypass merchant restrictions.

Currency requirements:

- Support NGN when enabled.
- Support USD only when the merchant is approved for it.
- Do not assume worldwide USD processing.
- Display the actual charged currency.
- Store money in integer minor units.
- Do not invent exchange rates.

Suggested USD product prices must remain configurable proposals.

Create independent NGN prices where necessary.

---

# SECTION 15 — COMPLETE PAYMENT LIFECYCLE

Implement the following:

PLAYER OPENS STORE

→ SELECTS PRODUCT

→ FRONTEND REQUESTS CHECKOUT

→ BACKEND AUTHENTICATES PLAYER

→ BACKEND VALIDATES PRODUCT

→ BACKEND LOADS SERVER PRICE

→ BACKEND VALIDATES CURRENCY

→ BACKEND CREATES PENDING ORDER

→ BACKEND INITIALIZES PAYSTACK TRANSACTION

→ PLAYER OPENS CHECKOUT

→ PLAYER COMPLETES PAYMENT

→ SERVER VERIFIES PAYMENT

→ ORDER IS FINALIZED

→ PURCHASED ENTITLEMENT IS GRANTED

→ INVENTORY UPDATES

→ PLAYER SEES SUCCESS

→ ITEM BECOMES AVAILABLE TO EQUIP.

A frontend callback must never be sufficient to grant an item.

Verify payment server-side.

---

# SECTION 16 — PAYMENT BACKEND ARCHITECTURE

Create clean services using the existing backend conventions.

Recommended responsibilities:

PRODUCT SERVICE:
Catalog and pricing.

ORDER SERVICE:
Order creation and lifecycle.

PAYSTACK SERVICE:
Provider API communication.

PAYMENT VERIFICATION SERVICE:
Transaction verification.

ENTITLEMENT SERVICE:
Secure ownership granting.

SUBSCRIPTION SERVICE:
Membership lifecycle.

PURCHASE HISTORY SERVICE:
Authenticated order history.

REVENUE ANALYTICS SERVICE:
Verified financial metrics.

WEBHOOK HANDLER:
Provider event verification and processing.

Do not build everything inside one controller.

---

# SECTION 17 — DATABASE DESIGN

Create or extend appropriate MongoDB collections.

## Product

- Product ID.
- Name.
- Description.
- Category.
- Asset reference.
- Prices by supported currency.
- Availability.
- Bundle contents.
- Season reference.
- Ownership rules.
- Timestamps.

## Order

- Order ID.
- User ID.
- Product snapshot.
- Amount.
- Currency.
- Provider.
- Transaction reference.
- Status.
- Timestamps.

## Payment Transaction

- Transaction ID.
- Order ID.
- Provider reference.
- Amount.
- Currency.
- Verification status.
- Provider status.
- Timestamps.

## Entitlement

- User ID.
- Item ID.
- Entitlement type.
- Ownership status.
- Grant source.
- Purchase reference.
- Activation timestamp.
- Expiration where applicable.

## Subscription

- User ID.
- Plan ID.
- Provider reference.
- Billing mode.
- Status.
- Start date.
- Renewal date.
- Expiration.
- Cancellation status.

Use appropriate unique indexes.

Keep historical payment records separate.

Do not perform destructive migrations.

---

# SECTION 18 — WEBHOOK SECURITY

Implement secure Paystack webhooks.

Requirements:

- Capture the raw request payload.
- Validate the x-paystack-signature header.
- Use HMAC-SHA512 with the configured secret key.
- Use safe signature comparison.
- Reject invalid signatures.
- Validate event types.
- Match events to existing orders.
- Verify successful payment status.
- Verify transaction amount.
- Verify currency.
- Verify transaction reference.
- Confirm the payment belongs to the correct order.
- Prevent duplicate processing.
- Handle retries.
- Log failures safely.

Do not expose sensitive data.

---

# SECTION 19 — PAYMENT VERIFICATION AND IDEMPOTENCY

A single successful payment must not grant the same purchase multiple times.

Implement:

- Unique transaction references.
- Idempotent order completion.
- Unique fulfillment identifiers.
- Concurrency protection.
- Duplicate webhook protection.
- Atomic entitlement updates where possible.
- Safe recovery after interrupted fulfillment.
- Transaction reconciliation.

Only grant purchases after verified successful payment.

Reject invalid payment amounts and currencies.

Do not trust client-submitted transaction status.

---

# SECTION 20 — FAILED PAYMENTS AND REFUNDS

Handle:

- Checkout initialization failure.
- Cancelled checkout.
- Abandoned checkout.
- Pending payment.
- Failed payment.
- Successful payment.
- Delayed webhooks.
- Duplicate events.
- Refunds.
- Disputes.
- Chargebacks.
- Membership renewal failures.

Display clear user-facing messages.

Maintain accurate transaction history.

Apply documented entitlement policies during refunds and disputes.

Never silently remove unrelated purchases.

---

# SECTION 21 — PURCHASE HISTORY

Create an authenticated purchase history screen.

Display:

- Product purchased.
- Purchase date.
- Amount.
- Currency.
- Transaction status.
- Order reference.
- Entitlement status.
- Refund status.

Users must only access their own records.

Protect sensitive payment information.

---

# SECTION 22 — REVENUE ANALYTICS

Create a protected internal revenue dashboard.

Use the existing administrative infrastructure if available.

Track:

- Successful paid orders.
- Gross sales.
- Refunded amounts.
- Net sales after refunds.
- Known transaction fees.
- Estimated revenue after known fees.
- Revenue by product.
- Revenue by category.
- Character skin sales.
- Weapon skin sales.
- Vault theme sales.
- Bundle sales.
- Season Pass sales.
- Membership revenue.
- Failed payments.
- Average order value.
- Repeat purchases.
- Store conversion.
- Revenue trends.

Separate test transactions from real revenue.

Do not fabricate sales numbers.

Use server-side authorization.

---

# SECTION 23 — MONETIZATION FUNNEL ANALYTICS

Track privacy-conscious events:

- Store opened.
- Product viewed.
- Product preview opened.
- Purchase initiated.
- Checkout opened.
- Payment verified.
- Payment failed.
- Product equipped.
- Season Pass viewed.
- Season Pass purchased.
- Membership activated.
- Membership cancelled.

Use actual event data.

Do not slow gameplay with analytics.

Avoid unnecessary personal data collection.

---

# SECTION 24 — PROMOTIONS AND DISCOUNTS

Implement optional support for:

- Launch promotions.
- Bundle discounts.
- Seasonal offers.
- Validated discount codes.
- Limited promotional prices.

Requirements:

- Server-side eligibility.
- Expiration checks.
- Usage limits.
- Discount stacking rules.
- Correct final amount.
- Consistent payment verification.

No fake scarcity.

No misleading discounts.

---

# SECTION 25 — FUTURE MONETIZATION EXTENSIONS

Prepare lightweight expansion points for:

## Cosmetic gifting

Allow eligible users to purchase cosmetics for another player.

Requires recipient validation, ownership rules, secure delivery and abuse prevention.

## Community creator marketplace

Approved creators may eventually contribute cosmetic vault themes.

Possible platform revenue through commissions.

Do not implement payouts before creator ownership, moderation and payment compliance are established.

## Story expansions

Future optional paid single-player story content.

Do not lock essential competitive systems behind purchases.

These are future extension points, not mandatory launch features.

---

# SECTION 26 — MONETIZATION PLACEMENT

Make purchasing opportunities discoverable without harming gameplay.

Appropriate placements:

- Cosmetic store.
- Character customization.
- Vault Architect appearance panel.
- Season Pass screen.
- Profile customization.
- Optional post-mission cosmetic recommendations.

Do not interrupt combat with payment advertisements.

Do not overload the UI with sales popups.

Never make free players feel forced to purchase.

---

# SECTION 27 — PERFORMANCE REQUIREMENTS

The monetization system must not slow RIVALS.

Requirements:

- Store route loads on demand.
- Payment scripts load only when required.
- Product metadata is cached appropriately.
- Product previews are optimized.
- Checkout runs outside the Phaser update loop.
- Network requests have bounded retries.
- API responses are compact.
- Payment errors do not freeze gameplay.
- Unused resources are cleaned up.

Maintain excellent mobile performance.

---

# SECTION 28 — SECURITY AND FAIRNESS

Never implement:

- Paid invincibility.
- Paid damage boosts.
- Paid speed advantages.
- Purchased leaderboard scores.
- Paid guaranteed victories.
- Paid trap damage increases.
- Unfairly hidden premium traps.
- Randomized paid loot boxes or gambling mechanics.

Keep the economy based on transparent purchases.

Protect:

- Authentication.
- Authorization.
- Payment endpoints.
- Product prices.
- Purchase history.
- Inventory ownership.
- Subscription status.
- Administrative revenue information.

---

# SECTION 29 — COMPLETE TESTING

Run unit, integration, API and browser tests where tools are available.

Test:

1. Product catalog loading.
2. Correct prices.
3. Currency validation.
4. Invalid currency rejection.
5. Product previews.
6. Payment initialization.
7. Paystack test checkout where credentials exist.
8. Payment verification.
9. Valid webhook processing.
10. Invalid webhook rejection.
11. Duplicate webhook handling.
12. Failed payment.
13. Cancelled payment.
14. Pending payment.
15. Successful entitlement delivery.
16. Duplicate purchase rules.
17. Character skin equipment.
18. Weapon skin equipment.
19. Vault theme equipment.
20. Bundle purchase.
21. Season Pass purchase.
22. Automatic seasonal reward delivery.
23. Membership activation.
24. Membership renewal where supported.
25. Membership cancellation.
26. Manual renewal fallback.
27. Refund reconciliation.
28. Purchase history.
29. Revenue analytics.
30. Unauthorized access.
31. Historical transaction preservation.
32. Removal of obsolete mining/claim interfaces.
33. Frontend production build.
34. Backend tests.
35. Mobile responsiveness.
36. No major gameplay performance regression.

Use Paystack test mode.

Do not charge real users during testing.

If credentials are missing, implement reliable mocked integration tests and clearly document which live Paystack tests remain unverified.

---

# SECTION 30 — FINAL EXECUTION ORDER

Follow this sequence:

1. Inspect the repository.
2. Audit old payment dependencies.
3. Remove obsolete mining and claim gameplay safely.
4. Design product catalog.
5. Implement Paystack backend.
6. Implement checkout.
7. Implement payment verification.
8. Implement signed webhook handling.
9. Implement order persistence.
10. Implement idempotent fulfillment.
11. Implement inventory ownership.
12. Build the cosmetic store.
13. Integrate character skins.
14. Integrate weapon skins.
15. Integrate vault themes.
16. Integrate emotes and effects.
17. Build cosmetic bundles.
18. Build the Premium Season Pass.
19. Build RIVALS Club.
20. Build Founder Supporter Pack.
21. Implement purchase history.
22. Implement revenue analytics.
23. Implement optional promotion infrastructure.
24. Test complete purchase journeys.
25. Fix security and correctness issues.
26. Run production build.
27. Document results.

Do not stop after planning.

Implement directly into the existing repository.

---

# FINAL DELIVERABLES

At completion, provide:

1. Monetization systems implemented.
2. Available purchasable products.
3. Actual configured prices.
4. Paystack integration status.
5. Payment security implementation.
6. Webhook verification tests.
7. Purchase fulfillment tests.
8. Inventory integration.
9. Season Pass functionality.
10. Membership functionality and billing mode.
11. Purchase history.
12. Revenue analytics.
13. Obsolete gameplay removed.
14. Historical data preserved.
15. Files created or modified.
16. Automated test results.
17. Production build results.
18. Missing merchant configuration.
19. Remaining limitations.

Do not fabricate payment success, merchant approval, product assets or test results.

## FINAL OBJECTIVE

Transform RIVALS into a premium free-to-play action-heist game that can generate revenue through functional cosmetic purchases, vault customization, bundles, season passes and optional memberships.

Use Paystack as the new primary payment provider, subject to merchant approval and supported payment capabilities.

Keep the game fair, lightweight, secure and genuinely enjoyable.

**INSPECT → IMPLEMENT → RUN → TEST → FIX → VERIFY → DOCUMENT.**

**DO NOT PROCEED TO PROMPT 20 UNTIL PROMPT 19 IS VERIFIED.**