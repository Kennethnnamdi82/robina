# Camera, street, checkout and support update

## Gameplay

- All four cameras keep a stable optical direction during translation. Manual
  first/third-person orbit refreshes the unshaken camera immediately. Existing
  POV transitions, zooms and wall sweeps remain; ADS shoulder distance blends.
- Authoritative position corrections are eased in presentation only. Collision,
  mission results, health, death cooldowns and rewards still use the server body.
- Shoulder-camera obstruction behind the shooter cannot select a backwards aim
  target. The independent physical muzzle/cover sweep still blocks shooting
  through walls. Aim intersection scratch vectors are reused.
- Idle grenades use the soldier's facing; deliberate aiming uses the aim target.
  This is shared by local play and the authoritative simulation. Damage, fuse,
  cooldown, stock reservation and difficulty are not increased.
- Civilian moving traffic is capped at 14 instead of 28 on every quality level,
  on both server and client. Existing allocated vehicle IDs/checkpoints remain
  compatible. Parked, occupied and pursuing police vehicles remain available.
  Hidden reserve traffic has no collision, target or grenade-blast interaction.
- Decorative work-zone cones are removed, and outer avenue mouths no longer
  terminate at the old grid's invisible perimeter walls. Buildings, mission
  doors and waterfront safety rails remain physical.
- The dispatch announcement is no longer mounted over gameplay. The extra
  police-status text is removed; wanted stars and pursuit gameplay remain.

## Checkout lifecycle

- Authenticated payment-return links use the normal hub descendant route rather
  than an exact parent route consuming the path and redirecting to the lobby.
- Signed-out returns go to ordinary login, without the app/history instruction
  screen. Closing a saved order uses client-side navigation.
- New Bachs sessions expire in ten minutes. The API supplies a server timestamp
  and deadline; saved orders and the payment dialog display a live countdown.
- Abandoned unpaid attempts disappear from player history at the deadline, and
  their checkout button is removed. Financial records are **not physically
  deleted**: a late independently verified payment must still be credited.
- Paid, fulfilled, review and unresolved verification records are preserved.
  Purchase locks are released only on provider-confirmed expiry/cancellation,
  or a provably unattempted initialization with no live lease. A browser clock
  cannot unlock an uncertain payment. Legacy sessions created with a longer
  provider window retain that provider lock until Bachs confirms closure.
- An expired/failed read cannot demote a concurrently verified paid order.

## Support the developer

- `/support` is integrated into the existing authenticated game navigation.
  Players can select a preset or enter USD $0.01–$10,000, to two decimal places;
  available payment methods can impose their own limits.
- Review and confirmation are explicit. The backend validates exact integer
  cents, binds the immutable amount and account to the retry key, and creates a
  Bachs pricing-based checkout without creating one catalog product per amount.
- Existing signed webhooks and independent checkout/payment reads verify the
  exact amount, currency, ownership, reference and environment before recording
  an exactly-once support receipt. Support grants no items or gameplay benefit.
- Support payments share history, expiry, authentication, rate limiting and
  refund/reconciliation protections with existing purchases. No new secret or
  payment infrastructure is required.
- Android update metadata is read from the actual published release manifest,
  not a stale branch CDN; the versioned APK size/signature metadata stays tied
  to that manifest before advertising the download.
- Provider contract: https://docs.bachs.io/api-reference/payments/create-checkout-session

## Verification

New regressions cover camera direction across all POVs, direct manual orbit,
reconciliation easing, backwards aim rejection, grenade facing, open avenues,
traffic reserve IDs, exact support amounts, duplicate and late payment handling,
saved-order routing, countdown removal and preservation of paid receipts.

`node scripts/verify-checkout-polish.mjs` runs the real React interfaces in
Chrome at 1280×900, 390×844 and 844×390. Every API/provider request is intercepted:
it checks custom amount confirmation, the countdown, history-to-original-checkout
resumption, no duplicate order, horizontal overflow and JavaScript errors.
Screenshots are generated in ignored `test-results/checkout-polish`.

These isolated checks do not constitute a real-money charge, Android hardware
test or proof of full-city frame rate on every device. Cloud release checks and
live readiness are reported separately when the update is published.
