# RIVALS — combined prompt 3 / original phases 7 + 8

This phase adds intelligent guards and interactive heist security to the existing **The Launch / Neon District** slice. Creative context: `src/TASK/GAME_VISION.md`. The supplied visual targets remain the art direction. Later missions, bosses, multiplayer, rankings, inventories and rewards are outside this phase.

## Implemented mechanics

Three configured security operatives patrol the district: a 75 HP guard, 100 HP ranged enforcer, and 175 HP heavy. Controllers implement idle, patrol, suspicion, investigation, alert, chase, attack, last-known-position search, return, hurt, stun and terminal death. Detection uses a cone, range, buildup and solid-object line of sight. Combat noise prompts investigation; network alarms carry an incident location across a separate configurable response range, without granting sight through walls. One alarm incident is consumed once per guard.

Enemies navigate around current solid geometry using one shared bounded grid/BFS workspace. The grid rebuilds when world geometry changes, paths refresh at most every 0.8 simulation seconds, decisions are staggered, and distant quiet patrols decide less often. Continuous movement checks expanded solid footprints; unreachable paths and stuck movement recover to patrol. At most two eligible enemies may pursue/attack concurrently. Ranged guards retreat at close range and advance when too far away; heavies move slowly and show a longer firing telegraph. Enemies share the existing projectile/damage pipeline, have hurt feedback and a procedural collapse on death, stop firing when dead, and count death once. Live NPCs have actual player collision bodies.

Two sweeping cameras perform occluded perception scans at 10 Hz. Lasers cycle through safe, dashed warning and solid live states, with text labels as well as color. Live beam contact causes real damage with a device cooldown and raises an alarm. Alarms last 12 quiet simulation seconds, use per-source cooldowns and do not spawn enemies or recursively broadcast.

The sector terminal presents a playable four-pad sequence: **2 → 4 → 1 → 3**. Keyboard 1–4, mouse and touch are supported. A wrong pad rejects the attempt and raises an alarm; retry is unlimited. Only completion authorizes the real sector door and suppresses the vault grid/concourse camera for 24 field seconds. Range and line of sight are checked at submission. The field simulation, physics, AI, projectiles and game clock pause during terminal isolation; disconnect safely returns control. The shipped puzzle has no deadline. The pure puzzle supports an optional configured deadline for future timed adapters.

Vault access requires all four latches:

1. Complete the sector hack.
2. During an **OPEN** phase, activate WEST then EAST within 3.5 field seconds and before the phase closes. Windows repeat: 2 seconds closed, 1 warning, 5 open. A missed window/link resets freely. The completed latch is retained.
3. Activate relay A inside the restricted sector.
4. Activate relay B inside the restricted sector.

The locked vault displays its missing conditions. Opening disables its actual solid footprint and slides/fades the supplied panel; reduced motion resolves immediately. Doors use the same short opening presentation. Closing an occupied door is rejected for both player and living NPCs. Core collection and south extraction retain their existing local training behavior. No competitive results or rewards are claimed.

The HUD reports actual live guard count, alarm countdown, phase window/link, relay count and suppressed security. Supplied optional alarm/failure/vault audio cues play from real events. Mobile security/HUD panels use compact portrait/landscape layouts to keep the central movement and aim region clear. Canvas-compatible alpha feedback marks enemy hurt states. AI visual diagnostics are available only when explicitly enabled by the isolated QA entry, never by a production URL parameter.

## Architecture and ownership

```text
src/features/rivals/
  ai/
    definitions.ts       enemy types, difficulty/ranges and decision budgets
    navigation.ts        shared geometry, bounded body-safe navigation
    EnemyController.ts   pure perception/state/navigation/combat timing
    EnemySystem.ts       Phaser NPCs, collision, weapon presentation, diagnostics
    ai.test.ts           state, occlusion, path, alarm and death tests
  security/
    definitions.ts       camera, laser, hack and timed-link map data
    HackPuzzle.ts        pure sequence validation, failure/retry/deadline model
    SecurityController.ts pure traps, cameras, alarms, hack and linked flags
    SecuritySystem.ts    Phaser hazard presentation and session/UI adapter
    security.test.ts     security models and linked world/session integration
  world/
    level.ts             placements, patrols and access prerequisites
    WorldState.ts        guarded interactions and retained access flags
    EnvironmentLayer.ts  actual solids, vault lock label and opening presentation
  combat/                reused bounded projectile/health/weapon systems
  core/                  typed session snapshots and scene controls
  game/ArenaScene.ts     fixed-step order and lifecycle owner
  ui/HackPanel.tsx       accessible keyboard/mouse/touch terminal overlay
  ui/ArenaHUD.tsx        live security and combat status
  security.css           scoped security/terminal presentation
tests/rivals/
  traversal.ts           input-driven route/aim helpers, no private state mutation
  security.spec.ts       real guard damage, QA gate and mobile hack checks
  world-combat.spec.ts   integrated heist + existing combat regression
```

The pure models import no Phaser, React, storage or network APIs. Security changes `WorldState` through validated interactions/flags; AI reads its current blockers, and combat registers NPCs through `Damageable`. There is one scene update loop rather than AI timers per entity. Teardown unregisters combat targets, releases NPC bodies/render objects/security labels, clears occupants and disposes existing audio, input, projectile pools and scene resources. Restart constructs fresh controllers and puzzle state.

Scene adapters publish one batched HUD snapshot per sampling interval; unchanged telemetry attributes are not rewritten. This keeps enemy positions, camera coordinates and field state consistent for subscribers and avoids redundant UI work. Loaded operative atlases are reused for enemies rather than duplicated. Floor chunks and static geometry are cached; offscreen device/NPC rendering is culled, effects bounded and HUD publication throttled. Physics keeps fixed 60 Hz steps with the existing 100 ms per-frame budget; under severe stalls, local field time slows rather than accumulating unsafe movement debt.

## Run locally

From `C:\Users\kenne\Documents\RIVALS\robina\robina`:

```powershell
npm.cmd run dev
# Open the authenticated website's /gaming route.

npm.cmd run dev:rivals
# Isolated local QA: http://127.0.0.1:8082/tests/rivals/index.html
# Optional development diagnostics: add ?validation=1, then expand QA controls.

npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e:rivals
npm.cmd run build
npm.cmd --prefix ../backend test
```

Existing public frontend configuration in `src/.env` is recognized by the production Vite configuration. No values should be copied into documentation. Runtime assets are already exported. `node scripts/prepare-rivals-security.mjs` reproducibly copies the three supplied optional audio cues and records hashes/provenance in `public/assets/rivals/security/manifest.json`.

Integration files also include `core/{contracts,session}.ts`, `rendering/SceneAssets.ts`, `assets.ts`, `combat/CombatSystem.ts`, `game/ArenaScene.ts`, `audio/GameAudio.ts`, `ui/{ArenaView,ArenaHUD,Lobby,MissionLobby}.tsx`, `data/missions.ts`, `pages/GamingPage.tsx`, the RIVALS Playwright configuration and benchmark script. Three optional supplied audio files plus their provenance/hash manifest are exported under `public/assets/rivals/security/`.

## Art and technical limits / next-phase handoff

- The three guards reuse detailed VEX/NYX/ROOK human atlases with role/health labels and distinct security ring accents. Dedicated V4 robot sprites were inspected and were a poorer match for the detailed environment. Distinct final enemy uniforms, silhouettes and authored attack/hurt/death cycles are still needed. Walking is authored; collapse, firing attachments and panel opening are procedural presentations using supplied assets.
- This district still needs bespoke environmental composition, less floor repetition, refined wall joins, lighting and animation work to reach the final cinematic reference. Functional completeness of this phase is not a claim of visual parity or a “10/10” finished commercial release.
- This is local single-player training. Refresh resets the run; there is no account inventory/reward mutation, authoritative competitive clock or anti-cheat. Backend source, databases, balances, historical entitlements and other website routes remain untouched.
- Optional hacking deadlines are model-level support; this shipped isolated/frozen-field terminal is intentionally untimed. An eventual timed terminal needs an independent UI clock and visibility/pause policy.
- Physical Android/iOS, Safari/Firefox, thermal soak and production authenticated end-to-end sessions need separate validation. Measured host/emulation performance and actual test results belong in the companion QA report.

The next authorized phase can consume `world.active` access flags, `world.events`, enemy snapshots and bounded damage/death events for mission orchestration. Add dedicated enemy art through the existing validated manifest/asset loader. Keep rewards and competitive validation server-authoritative when those phases are requested. Do not start the next combined prompt automatically.

See [verification and evidence](RIVALS_COMBINED_03_QA.md) for final results, screenshots and outstanding limitations.
