# RIVALS — combined prompt 2 / original phases 5 + 6

> Historical phase snapshot. The current AI/security implementation and integrated verification are documented in [combined phase 3](RIVALS_COMBINED_03_QA.md).

Creative context: `src/TASK/GAME_VISION.md` (there is no `GAME_CONTEXT.md` in this checkout). This phase continues the existing gaming route and asset foundation. The playable build is **The Launch / Neon District**, a local world/combat training slice. The full Security Breach mission, AI, advanced security, competitive validation and rewards remain later work.

## What is implemented

- One 28 × 22, 64-unit-tile district with insertion, live-fire lab, concourse, restricted vault room and south extraction. Navigation signs and minimap markers identify the route. The north/west vault bypasses were sealed; its entrance is the authorized sector door.
- A shared level definition owns walls, spawn, decoration, solid footprints, cover, zones, doors, terminals, vault/core/extraction objects, targets, and future enemy/security markers. Markers are data, not a claim of enemy AI.
- Closed doors block both the player's foot collider and swept projectiles. Opening disables the same collision footprint and hides the closed panel. Closing is rejected while the operative occupies the aperture. The sector door requires the access terminal; the transit shutter can be operated from either side.
- Interactions validate distance and line of sight at the simulation step. The insertion uplink is a real toggle; the west range switch enables actual return-fire projectiles; the sector terminal authorizes vault access; vault access enables core collection; south extraction requires that collected core. A single med charge heals up to 25 HP and is not consumed at full health. Event history is bounded to 32 entries.
- The carbine fires while moving and aiming. It has 25 damage, 0.16-second minimum fire interval, 900-unit/second pulses, 0.85-second lifetime, 765-unit range, zero spread, a 12-round magazine and 1.25-second reload. R / touch Reload requests reload; holding fire on an empty magazine starts reload. Training reserve is unlimited and disclosed. No account inventory is consumed.
- Three holographic targets have 100 HP, actual damage and disabled states. They are stationary training objects, not enemy AI. The optional fixed return-fire emitter shoots north for 15 damage every 1.3 simulation seconds. Its pulses use the same collision/ownership pipeline as the carbine.
- Health has damage events, duplicate-event guards, a 0.32-second grace window, hurt feedback and terminal death until restart. Dodge grants immunity for its first 0.12 seconds, then loses immunity; its 0.10-second recovery restricts firing. Existing dodge cooldown remains 1.1 seconds. Pausing/canceling motion cancels dash immunity; blocked damage never extends immunity.
- A 48-slot projectile pool uses continuous segment collision and nearest-hit selection against cached wall/cover/door geometry and damageable circles. It filters same-team/owner/dead targets, expires by lifetime/range/bounds, and is cleared on death/teardown. There is no physics body per projectile.
- Bounded muzzle/impact effects, projectile trails from the supplied pulse frames, hit confirmation, target health labels, damage feedback, a rotating weapon attachment, modest recoil, and supplied sound cues. Effects are quieter under reduced motion. Player hit shake obeys the existing setting.
- A shared hand-plane height keeps the attachment, projectile presentation, mouse-to-ground conversion and touch reticle aligned. Firing is aimed at the visible cursor plane. A new muzzle flash is rendered at least once even if that rendered frame exceeds its short effect lifetime.
- Desktop mouse aiming/hold-click firing and R reload; mobile left movement, right aim and separate Fire/Reload/Dodge/Interact controls with pointer ownership/cancellation. Existing sprint, settings, pause, Continue and restart are retained.
- HUD shows actual ammunition/reloading, hits/disabled targets and local world guidance. Training extraction is explicitly local; there is no invented score, XP, ranking or reward.

## Architecture

```text
src/features/rivals/
  world/
    level.ts                 LevelDefinition + The Launch data + merged wall geometry
    WorldState.ts            pure interactions/prerequisites/object state/events
    GroundLayer.ts           static floor tile chunk cache
    EnvironmentLayer.ts      Phaser wall/prop/body/object adapter
    neonDistrict.ts          existing supplied visual prop placements
    trainingVault.ts         compatibility alias + floor-frame selection
  combat/
    weapons.ts               configurable weapon definitions + pure timing/ammo/reload
    Health.ts                reusable damage event/team/health contract
    geometry.ts              continuous segment/box/circle queries
    ProjectilePool.ts        bounded pure simulation + damageable interface
    CombatSystem.ts          Phaser presentation, target fixtures, local equipment adapter
  game/
    ArenaScene.ts            lifecycle + fixed-step orchestration
    simulation.ts            bounded per-frame physics budget
    createGame.ts            existing Phaser owner and disposal
  input/                     shared mouse/keyboard/touch command buffer
  core/                      session snapshot, settings and scene boundary
  audio/                     bounded optional HTML audio cues
  ui/                        live HUD, minimap, touch controls, menus and briefing
```

`DamageEvent` records ID, source, team, amount and angle. `Damageable` supplies identity, position, radius, alive and damage functions for future enemies/bosses. `WeaponDefinition` supplies damage/timing/range/spread/reload/presentation parameters; `WeaponController` has deterministic spread support. `WorldState` and projectile/weapon/health models import no Phaser, React, storage, account or network APIs.

The scene manually advances Arcade with a capped 100 ms frame budget, preserving its 60 Hz fixed steps. This prevents seconds of physics catch-up after a long render stall. Under severe stalls local simulation time slows; it is not an authoritative competitive clock. A future competitive implementation must validate commands and timing server-side.

Floor tiles are composited once into 256 px chunks from the existing atlas, then culled with a movement margin. This reduces repeated floor draw work. Walls, objects, collisions and effects remain independent. The floor cache adds approximately 9.63 MiB RGBA; the HUD texture estimate includes it plus loaded base/combat image estimates, and excludes effect textures, decoding copies and browser/native memory. Static collision geometry is created once. Offscreen walls, props, lights, shadows, scanners and target presentation are culled. No fullscreen shader or additional package was introduced.

Owner teardown releases input, audio, projectile/effect pools, ground textures, map bodies and scene resources. Pausing freezes simulation, ammo, reload and projectile travel; Continue preserves local state. Restart constructs fresh world/health/equipment state. Existing data APIs/databases/wallet code are untouched.

New files: `combat/{Health,weapons,geometry,ProjectilePool,CombatSystem}.ts`, `combat/combat.test.ts`, `world/{level,WorldState,GroundLayer}.ts`, `world/world.test.ts`, `game/simulation.ts`, `game/simulation.test.ts`, `tests/rivals/world-combat.spec.ts`, `scripts/prepare-rivals-combat.mjs`, combat runtime exports/manifest/license, and this phase's documentation/evidence.

Updated integration: `world/{EnvironmentLayer,trainingVault,neonDistrict}.ts`, `game/{ArenaScene,createGame}.ts`, `characters/CharacterController.ts`, `input/{InputBuffer,InputManager}.ts`, `core/{contracts,session}.ts`, `audio/GameAudio.ts`, `assets.ts`, `rendering/{SceneAssets,CinematicEffects}.ts`, `data/missions.ts`, the existing lobby/briefing/HUD/minimap/controls/help/arena components, `rivals.css`, `tests/rivals/controller.spec.ts`, and `scripts/benchmark-rivals.mjs`. Dependencies and backend source were not changed.

## Assets and reproduction

`node scripts/prepare-rivals-combat.mjs` reproduces eight small exports in `public/assets/rivals/combat/`, with source paths, byte counts and SHA-256 hashes in its manifest. Total exported content is 101,220 bytes, of which 35,284 bytes are initial gameplay images; audio loads only on enabled playback. Sources remain untouched in the supplied all-in-one V4 pack.

- `carbine.png`: supplied Kenney `weapon_machine.png`, CC0; license included. The V4 pulse-rifle icon was inspected but its flat circular inventory art does not work as a held weapon.
- `muzzle.png`, `pulse.png`: supplied V4 effect strips, correctly sliced at 96 px and 64 px respectively.
- Four supplied WAV cues: `turret_fire`, `laser_hit`, `core_pickup`, `extract_success`.
- Existing Phase 02 floor/walls/props/operative atlases remain the principal visual foundation. No concept image is substituted for a playable scene.

The small weapon attachment and supplied effect strips need higher-detail matching art for the final visual target. Operatives still have authored walking only; attack/hurt/interaction/defeat use documented pose fallbacks, with a separate functional weapon rig. There is no authored full-body firing/reload/death cycle. Wall/prop perspective joins and repeated floor variation remain visual polish work.

## Run locally

From `robina/robina`:

```powershell
npm run dev:rivals
```

Open `http://127.0.0.1:8082/tests/rivals/index.html`, select Play, then Start Mission. The integrated site remains `npm run dev`, authenticate, then `/gaming`. The production configuration continues to recognize the existing ignored `src/.env` file; no values are copied into documentation.

Controls: WASD/arrows move, Shift sprint, Space dodge, mouse aim, hold left click fire, R reload, E interact, Escape pause. On touch use Move/Aim sticks and Fire/Reload/Dodge/Interact. Enable return fire at the west console when ready; use cover or dodge to avoid pulses. The opening uplink checkpoint is separate from the local vault/extraction exercise.

```powershell
npm test
npm run typecheck
npm run lint
npm run build
node scripts/build-rivals-preview.mjs
node node_modules/vite/bin/vite.js preview --config vite.rivals.config.ts --outDir test-results/rivals-preview --host 127.0.0.1 --port 8083 --strictPort
```

In another terminal:

```powershell
$env:RIVALS_TEST_URL = 'http://127.0.0.1:8083'
npm run test:e2e:rivals
node scripts/benchmark-rivals.mjs --combined02
```

Use `npm.cmd` on Windows hosts whose PowerShell policy blocks `npm.ps1`. On memory-constrained build hosts, process-scoped `RAYON_NUM_THREADS=2` and `GOMAXPROCS=2` avoid overlapping compiler workers. Run heavy checks sequentially.

See `RIVALS_COMBINED_02_QA.md` for measured results, screenshots, limitations and outstanding issues.

## Next phase handoff

Do not begin the next phase automatically. Reuse `Damageable`, team/ownership events, `Health`, weapon definitions and the level markers for approved enemy/security systems. Add behavior outside `ArenaScene`, and keep body/visual pivots aligned to ground-plane coordinates. Targets and the fixed training emitter can remain fixtures for regression tests.

Build advanced terminals/security/mission logic on explicit `WorldObject` prerequisites/events and versioned level data. The current extraction is a training interaction, not the full timed Security Breach operation. Persistent outcomes/rewards need authoritative validation, authenticated ownership checks, idempotency and an actual verified mission contract before any account writes. None are implied by frontend validation.

Retain BaseDrop history, entitlements and balances. Core play remains free, with equal operative effectiveness and no purchased competitive advantage. Keep all active game changes inside the gaming experience.
