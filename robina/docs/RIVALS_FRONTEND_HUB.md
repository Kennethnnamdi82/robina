# RIVAL HEIST frontend command hub

This is a frontend-only design and interaction update. No backend routes,
database models, server settings, Render deployments, leaderboard APIs or
mining balances were added or changed. Existing login remains unchanged.

## Pages

- `/`: cinematic RIVAL HEIST lobby based on the supplied menu reference.
- `/play?operation=reserve|reactor|archive`: briefing and the existing 3D raid.
- `/missions`: three existing venue operations, status, best times and recorded
  run history with completed-objective details.
- `/customization`: local callsign and calling-card finishes. The actual
  in-game player model and weapons are not replaced.
- `/profile`: browser-local completion counts, eliminations, best time and history.
- `/leaderboards`: explicitly fictional preview standings and a separate
  view of real browser-recorded runs. There is no shared online ranking.
- `/rank`: practice tiers calculated from retained browser records.
- `/settings`: graphics, camera, input, lighting, audio, HUD and motion options.

The old mining pages stay unmounted. Their obsolete links redirect to the
lobby. `/profile` and `/rank` now belong to the game instead of mining, so their
old hosting redirects were removed. The explicit classic fallback remains at
`/?engine=2d`; it is not the default or a main-menu action.

## Local-only behavior

Settings use `rivals_hub_settings_v1`. Dossiers are scoped to the current
existing login identity under `rivals_heist_dossier_v1:<identity>`. The last
200 completed, failed or abandoned actual runs are retained. Runs that never
started do not become fake history. Recorded callbacks are idempotent by run
ID. Storage failures leave the app usable and show a session-only notice.
Browser data is editable and unverified, not competitive authority; clearing
storage loses it and it does not sync between devices.

Preview leaderboard fixtures never enter a player's dossier. Practice points
are 1,000 per successful extraction plus a time bonus of max(0, 600 − seconds)
and 25 points per elimination (capped at 500). The existing hit count includes
melee and is deliberately not presented as firearm accuracy. Other outcomes score zero. No
currency, economic rewards, account entitlements or global rankings change.

The renderer is lazy-loaded only for `/play`. Settings opened during a paused
raid cover the existing mounted runtime instead of disposing the run. The 3D
world, geometry, models, combat and mission rules remain unchanged. Only the
frontend launcher, preference bridge and local result callback were extended.

## Menu artwork

Built-in image generation was used, not the CLI/API fallback. The selected
source remains under the normal generated-images directory. It was inspected
and compressed without content changes into:

`public/assets/rivals/hub/menu-keyart-v1.webp` (1536×1024, 135,914 bytes).

The interface labels it as menu key art, not in-game footage. It is not a
replacement for any environment or character model.

Final generation prompt:

> Use case: stylized-concept. Asset type: cinematic background illustration for
> the RIVALS: RIVAL HEIST frontend main menu, not an in-game screenshot. Create
> a premium photorealistic tactical urban-heist key art, landscape 1536x1024
> composition. A lone adult undercover operative in dark realistic street
> tactical clothing, viewed from the back, standing on the right third of the
> frame overlooking an outdoor financial district with stone bank architecture,
> a street car and distant city towers. Mature grounded proportions, understated
> authentic equipment, no visible gore or action injury. Dusk blue-black shadows
> with restrained warm gold sun through atmospheric city haze, wet asphalt
> reflections, subtle photographic film grain, sophisticated high-budget
> military-action game cover-art finish. Keep the left half dark and uncluttered
> as negative space for live HTML game title and navigation. Subject stays on
> the right, bank and skyline beyond. Image is background art only: absolutely
> no text, no letters, no logos, no HUD, no buttons, no UI, no border, no watermark.
> Realistic surfaces and physically plausible light; avoid cartoon, chibi,
> neon-purple sci-fi, oversaturated flames, exaggerated guns. Do not alter any
> existing project image or game models.

## Verification

Focused tests cover navigation, login gating, settings persistence, local
recording and deduplication, correct mission outcomes, local practice rank,
profile separation, fictional-data labeling, paused settings and retained
runtime lifecycle. Production-browser checks include real 3D start/pause/exit,
phone-width layouts, deep links and absence of new API requests/writes.

The preexisting unrelated animation-name diagnostic failure in
`HumanoidAnimator.test.ts` is outside this frontend task. Passing focused checks
must not be represented as a clean run of the entire game test suite.

### Final verified release — 2026-11-04

- 44 focused unit/component tests passed; App and Node TypeScript checks passed.
- Production build passed with the existing dependency/chunk-size warnings.
- All 10 local production-browser checks passed, including real 3D start,
  pause/settings/return and exit, phone-width pages, persistence and login gates.
- The phone-sized frontend walkthrough passed again on protected Vercel
  staging, including proof that the application backend received no new
  requests besides its existing session read. Privy's existing public SDK
  app-configuration reads are separate from the application backend.
- Staging HTTP preflight passed: six obsolete-page/alias redirects, seven
  game-page deep links, fourteen unchanged compressed models, the lazy hub
  module and the 135,914-byte menu artwork.
- Frontend deployment `dpl_842fb1513nFdHTAGHipVacbvsUrR`
  (`robina-mining-lzgpehynv-venomee.vercel.app`) was promoted to the existing
  `https://robina-mining.vercel.app` domain.
- Hosted entry: `/assets/index-C9j4tWFW.js`; hub: `GameHub-BzeinaY3.js`.
- No backend files, Render deployments or GitHub pushes were made. The prior
  working frontend `dpl_JC9sCKCKUfyGuXjrLktvXVytQzjX` remains a rollback target.

Phone/desktop screenshots are in `docs/rivals-3d/frontend-hub/`. Generated key
art is a menu illustration, not a claim about the existing game's rendering
quality. No phone-FPS or new hosted cold-start benchmark is claimed.
