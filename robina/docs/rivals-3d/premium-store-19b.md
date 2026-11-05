# Exchange / frontend delivery

## Entry points

- Lobby → Store; `/store` is the featured collection.
- `/store/weapons`, `/store/grenades`, `/store/health`, `/store/characters`, `/store/cosmetics`, `/store/effects`, `/store/bundles`, `/store/season`, `/store/founder`.
- `/inventory`, `/purchase-history`, `/recovery`.

These routes use the existing authenticated game hub. No new account, database,
payment provider, network endpoint or gameplay gate is introduced.

## Presentation and boundaries

The complete proposed catalog uses the brief's default USD prices. Every product
is a design preview; existing field first-aid is not sold. Missing firearm assets
remain explicit unavailable placeholders. Current reference stats are derived
from `EQUIPMENT`, separately from proposed magazine and ammunition specifications.
No accuracy percentages or higher-tier advantages are invented.

Static transparent studio renders reuse shipped assets and the existing operative
finish/idle animation. Character costume cards show the **base operative**, not a
claim that eight finished costumes exist. Color studies in the rifle viewer only
modify privately loaded preview materials. They are not completed weapon skins.
Effect playback is a labeled UI motion study, not an authored emote or game event.

Paystack and Base USDC appear as selectable, disconnected payment presentations.
The confirmation button opens a sample pending state. A clearly labeled selector
allows reviewing all other purchase states. There is no payment request, wallet
connection, simulated entitlement, frontend receipt or ownership persistence.

The recovery page displays all nine requested states. The `01:59:59` display is
static sample copy, not a ticking or authoritative clock. Its mission-entry lock
is an isolated **UI study** only. Actual death, retries, free recovery eligibility,
medical pickups, mission entry and health are unchanged. The proposed five-free-
grenade welcome allocation is identified as unimplemented, not granted. Existing
three-grenade mission allocation and carrying capacity are unchanged.

Inventory has an empty, honest default and clearly distinguishes existing issued
mission-kit configuration from purchased account ownership or live ammunition.
The optional read-only `StoreAccount` prop supports supplied ownership, equipment,
balances and receipts without creating independent frontend entitlements. No
existing RIVALS catalog/ownership service was found. Equip controls remain disabled
until a supported equipment integration exists. No active season, season XP,
configured reward, scarcity, discount or founder sales count is fabricated.

## Performance and accessibility

Store and recovery routes are lazy chunks. Product cards use static images, not
WebGL canvases. The explicit 3D inspection action loads one demand-rendered viewer;
there is no ongoing animation loop. Closing it releases private geometries,
materials, textures, environment target, controls and renderer/context. Gameplay
does not import the store or its renderer. No dependencies or runtime assets for
the existing game were changed.

The category rail becomes horizontal touch navigation on phones. Product grids
adapt to two columns. Radix dialogs trap focus, support Escape and lock background
scroll. System reduced-motion settings and the hub's reduce-motion preference
disable concept-effect animation. Prices remain visible without hover.

## Verification

- Store unit tests: complete catalog, all twelve routes, search/sort, comparison,
  missing assets, grenade exhaustion, inventory/receipt boundaries, all purchase
  states, all recovery states and no implicit WebGL.
- Game-hub regression tests preserve Play, existing pages, saved preferences and
  local mission records.
- Local Chrome: 320–1440px layouts, landscape, all category navigation, no page
  overflow, dialogs/focus trap, static recovery, actual 3D model load and disposal.
- Studio artwork can be reproduced with `node scripts/prepare-rivals-store-art.mjs`.

Physical phone performance and any future payment/ownership services are outside
these frontend checks. Nothing in this change enables charging users.

Completed locally: the 273-test RIVALS regression run passed; after the final
accessibility and integration refinements, all 40 targeted store/hub/auth tests
passed. All three isolated Chrome checks and both compiled-app checks passed,
including the real 3D game's draw/pause/exit flow. App and build TypeScript checks,
focused ESLint (zero warnings) and the final production build passed. These checks
do not enable real payments, recovery restrictions or account entitlement writes.
