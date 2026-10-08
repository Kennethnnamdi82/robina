# RUGFIRE — The Launch

A desktop third-person browser combat slice, available on the existing `/gaming` route after sign-in. The slice reuses installed Three.js and is separate from wallet/payment actions.

## Play

Run `npm run dev`, open the app, enter Gaming, and select **Enter operation**. Mouse capture requires a direct click in a desktop browser. WASD moves, mouse looks, left mouse fires, right mouse aims, Shift sprints, Space dodges, R reloads, 1/2/3 switches weapons, E disables the facility core, and Escape pauses. The pause screen offers restart and return to base. Audio and fullscreen controls are available in the lower right.

Advance through Launch District, Market Street, the sniper-controlled facility approach, and the liquidity courtyard. After clearing the courtyard, approach the marked terminal and press E. Defeat Mega Rugger, then reach the extraction ring. The boss summons reinforcements, telegraphs damaging floor zones, and becomes more aggressive below 20% health. Cover blocks both player and enemy gunfire. Dodging grants a brief evade window with a cooldown. Sector supplies restore some health and reserve ammunition; limited health recovery begins after eight seconds without damage.

## Modules

- `engine.ts`: render lifecycle, shoulder camera, hitscan gunfire, enemy AI, physical enemy projectiles, mission integration, HUD snapshots.
- `runtime.ts`: combat state, magazines, weapon-specific cadence, reload cancellation, health, cooldowns, mission report rewards.
- `physics.ts`: shared ray obstruction and substepped movement collision for cover, actors and camera.
- `actors.ts`: replaceable actor factory and procedural skeletal animation; callers depend on the Actor interface.
- `world.ts`: merged static geometry, colliders, locally generated sign/road textures and practical lighting.
- `audio.ts`: browser Web Audio effects, gesture unlock, mute, suspension and cleanup.
- `effects.ts`: bounded particle and tracer pools.
- `gameData.ts`: weapon/enemy tuning, mission encounters and rewards.
- `Hud.tsx`, `RugfireMission.tsx`, `GamingPage.tsx`: application presentation; the simulation runs outside React. HUD snapshots publish at approximately 12 Hz.

Art is locally authored procedural geometry, not final AAA character or environment assets. The actor/world interfaces support later production art replacement. Audio is synthesized rather than recorded. Single-player rewards are operation report values and a `rugfire:mission-report` CustomEvent integration hook, not backend currency grants. Desktop keyboard/mouse is required. No multiplayer, marketplace, blockchain, or purchases are part of this feature.

## Verification

- `npm test -- --run src/features/rugfire/combat.test.ts`
- Run `npx playwright test --config playwright.rugfire.config.ts`; it starts an isolated Vite harness on port 8081.
- `npx eslint src/features/rugfire src/pages/GamingPage.tsx tests/rugfire playwright.rugfire.config.ts`
- `npm run build`

The Playwright harness lives under `tests/rugfire`, outside the production entry. It tests real UI controls and a deterministic mission run using actual raycast damage, the facility interaction, boss phase triggers, extraction, cover obstruction, sniper warnings and death. The scripted run uses controlled firing positions and simulation ticks; it is not a human difficulty or performance assessment. It also saves briefing/combat screenshots in `test-results`.

The browser config uses locally installed Windows Chrome. Set PLAYWRIGHT_CHROME_PATH on another platform. Full-project type checking now passes; use npm run verify:release for the complete local release gate. See ../../../../PRODUCTION_AUDIT.md for audit results and live release checks.


## Runtime safeguards

Physics uses fixed 60 Hz steps with bounded catch-up. Static actor parts are merged by material; only four nearby district lights are active. Gun sounds reuse audio buffers, muzzle lighting and combat effects use bounded pools, and resolution decreases on slow devices. Paused scenes render less often. Lost graphics contexts, failed rendering and blocked mouse capture expose restart controls. Starting a disposed engine cannot resume it. Unsupported audio runs silently.
