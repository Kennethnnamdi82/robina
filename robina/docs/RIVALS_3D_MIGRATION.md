# RIVALS 3D development migration

## Safety baseline and audit

Started on `feature/rivals-3d-migration` at `368e949` with a clean working tree. The existing branch and `main` pointed to that same commit; no branch was created/switched, commit reset, push, deployment or database action was performed. The production entry, authentication, backend, payments, PWA and existing Phaser runtime are outside this change.

The frontend entry is `src/main.tsx` → `App.tsx` → authenticated `GamingPage`. Phaser **3.90.0** starts lazily through `features/rivals/game/createGame.ts` and `ArenaScene`. Arcade provides fixed-step player collisions; the custom projectile pool performs swept 2D impacts. The layout is a 28×22 tile grid, with explicit props, doors, terminals, cameras, lasers, objectives and spawn/patrol data in `world/level.ts`. Camera following belongs to the Phaser adapter. React HUD/input use a throttled `ArenaSession`; weapons, health, character controller, mission engine, boss controller, security puzzles and enemy FSM/navigation are already engine-independent.

Three.js **0.186.1** and its types are already installed. The older Rugfire renderer includes reusable GLTF/skeleton loading and animation helpers. Supplied public GLBs include an animated human operator, security characters, boss, three weapons and modular props. No new asset downloads or paid service is needed. These are compatibility assets, not a newly authored final RIVALS cast. No persisted player-created vault schema/editor or asynchronous challenge runtime was found in the active RIVALS implementation; they cannot be claimed as migrated. The existing card-game backend is unrelated and will remain untouched.

The immediately preceding Phaser phase has 110 passing unit tests. Its last full browser run had 23 passes and 3 failures (outdated uplink assertion and two automation firing/positioning cases). Its complete desktop victory verification remains unfinished. This migration preserves that source and does not relabel that prior phase as fully verified.

| Category | Reuse / adaptation |
| --- | --- |
| A — unchanged rules | `Health`, `WeaponController`, `CharacterController`, `MissionEngine`, `BossController`, `EnemyController`, `SecurityController`, `WorldState`, level data |
| B — UI and asset adapters | Existing HUD, touch sticks/actions, hacking panel, animation/GLTF utilities; isolated session suppresses persistent practice writes |
| C — constrained planar logic | NPC patrol navigation remains explicitly on the converted ground floor; real 3D ray/solid checks protect shooting and camera occlusion |
| D — replacement adapters | Three rendering, kinematic Y-up collision/gravity, swept 3D projectiles, camera-aware movement/aiming and four camera controllers |
| E — untouched | Production app/authentication/PWA/backend/payments/data, Phaser scenes/renderer and existing website routes |

## Implementation sequence

1. Establish this audit and explicit development-only gate.
2. Convert the existing map into one Y-up world with shared collision data; validate conversion.
3. Reuse rule models in one runtime; add gravity/platform contacts and 3D projectiles.
4. Add tactical, side, TPS and FPS cameras with independent local zoom preferences.
5. Reuse supplied animated GLBs, modular materials and bounded effects.
6. Integrate existing mobile controls/HUD/puzzles and mission/boss events.
7. Test safety gates, pure physics/camera rules, real browser gameplay, fallback, build and resource cleanup; measure emulation separately from physical phones.

## Coordinate and geometry contract

One legacy pixel equals **0.025 metres**. Legacy X maps to world X; legacy Y maps to world Z. World Y is elevation; gravity points down Y. Original map/object IDs and puzzle prerequisites remain unchanged. Walls/closed security doors are full-height solids. Added development platform/stair metadata is explicit and does not rewrite legacy records. NPC routes remain ground-floor routes and are not presented as a general multilevel navmesh.

All POVs share one player, enemy roster, boss, mission, security clock and projectile pool. Side mode uses a physical horizontal/jump plane, with deliberate **grounded depth-lane movement** to traverse the existing north/south corridors; depth changes are constrained while airborne. Jump/fall/gravity exist in the simulation, rather than being a camera-only rotation. Full-height security solids remain unjumpable. This side-mode traversal contract must be tested throughout the converted raid; it is not a claim that arbitrary future vaults already support platforming.

## Major risks and performance policy

Current map heights and platform data are additions, not recovered source facts. GLB animation/style compatibility needs visual review. Four views require different aiming projections, occlusion and sensitivity. A small kinematic solver is appropriate for the current static map; dynamic rigid-body interactions would require further physics work. No claim of universal arbitrary-vault conversion is made. Use instancing, shared geometry/materials, bounded projectiles/effects, limited lights/shadows, capped DPR and explicit cleanup. Device targets are 30 FPS on budget Android and up to 60 FPS on capable devices; they remain targets until measured on physical hardware.

## Implemented development foundation

`src/features/rivals/three/` contains the shared Y-up world conversion, kinematic solver, swept 3D projectile pool, camera rig, GLTF owner, modular world renderer, runtime adapter, memory-only session and React sandbox. The adapter consumes the existing rule classes directly. The only change to the older Rugfire renderer is exporting its existing rigid-mesh batching helper; its behavior is unchanged. No Phaser scene or gameplay rule file is replaced.

All raids start tactical. POV selection and V cycle tactical/side/TPS/FPS; C switches FPS/TPS. Camera changes do not recreate the runtime, player, mission, enemies, boss, health, ammunition or security. Side mode has grounded depth lanes, gravity, jumps and platform landing; J and the touch JUMP control jump, while Space keeps its existing dodge role. FPS/TPS use right-drag mouse look or the touch aim stick. ADS is right-mouse or the touch ADS button. Camera rays shorten low-angle views against full-height solids. Player geometry is hidden in FPS; an actual supplied GLB weapon is mounted to that camera.

ZOOM taps cycle bounded presets. Long-press opens presets/reset and camera sensitivity. Zoom preferences use the separate local `rivals_3d_camera_preferences_v1` key; mission data never persists from this sandbox. Low/medium/high map to the existing low/balanced/high settings model. Low defaults to capped DPR 0.8 and no dynamic shadows; high enables one shadow source. Sustained slow frames can lower DPR with hysteresis rather than oscillating quality. The development overlay reports rolling FPS, p95 frame time, draw calls, triangles, DPR and renderer-specific resource counts.

The map uses the supplied RIVALS floor atlas, supplied Rugfire crate models, animated human/security/boss GLBs and weapons, plus explicit modular wall/door/terminal geometry. These are development compatibility assets. Final RIVALS VEX/NYX/ROOK 3D likenesses, authored architectural detailing, lighting and final visual parity remain incomplete.

The runtime connects existing guard patrol/detection/alarm/attack/damage/death rules, sector hacking, phase pads, relays, vault prerequisites, the Guardian model and mission/extraction events. It does not implement a new boss, mission economy or live multiplayer. Full 3D boss/heist completion still requires integrated playthrough verification; connecting a model is not proof of that entire loop.

## Run and test on a phone

From the frontend directory, start the isolated, account-free sandbox:

```powershell
npm.cmd run dev:rivals3d
# Laptop: http://localhost:8084/
# Phone on the same Wi-Fi/hotspot: open the Network URL printed by Vite.
# Example: http://<laptop-private-IPv4>:8084/
```

The dedicated launch command enables the development flag automatically and listens on the local network. Its homepage, `/gaming` and `/login` redirect directly to the isolated sandbox without loading the website's authentication providers. No environment configuration, wallet, Google sign-in or backend is needed. Keep the laptop and phone on the same network; use the laptop's private IPv4 address, not `localhost`, on the phone. Stop any previous server on port 8084 before launching again. For laptop-only access, use `npm.cmd run dev:rivals3d -- --host 127.0.0.1`.

No authenticated session or backend record is created. The isolated entry is outside the production application import graph and checks both DEV and the explicit flag. Direct use of its Vite configuration without the flag returns 404, and that configuration rejects build commands. The regular `npm.cmd run dev` website and its production authentication/PWA are unchanged.

Chrome treats a private HTTP address differently from `localhost`: `crypto.randomUUID` is unavailable there. The shared arena session now uses `crypto.getRandomValues` to generate a UUID v4 when the native UUID method is absent. This fixes session creation in both the 3D sandbox and its Phaser fallback over LAN HTTP; the native HTTPS/localhost path and gameplay behavior stay the same. The local-access browser suite includes actual LAN-origin desktop/mobile launches, not only mobile viewport emulation at localhost.

If a terminal command produces no output, check for a project file named `npm.cmd` shadowing the installed npm executable in Command Prompt. An empty untracked file with that name was found and preserved as `npm.cmd.empty-backup` during the blank-screen investigation. The launcher also keeps its startup messages visible instead of clearing the terminal.

The original authenticated website's `/gaming` stays Phaser when served with its normal configuration. Inside the experiment, use **ORIGINAL PHASER FALLBACK** to load the existing isolated Phaser entry; navigation leaves the Three runtime rather than running both engines. You can also stop the 3D server and run the unchanged `npm.cmd run dev:rivals`. No Git checkout is needed to reject the experiment. Do not switch to `main` with these uncommitted migration edits; keep review work on the existing feature branch.

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd exec -- playwright test --config playwright.rivals3d.config.ts
node scripts/verify-rivals3d-gate.mjs
node scripts/benchmark-rivals3d.mjs
npm.cmd run build
```

On a physical Android phone, record model, browser/version, quality and orientation. Let shaders warm for 15 seconds, then traverse the transit shutter and fight a guard while switching through all views. In side mode jump/fall on the west practice platforms, shift depth lanes on the ground, then switch while airborne near cover. Try the closed security gate in every POV; verify no crossing. Check zoom/ADS, three-finger move/aim/fire, incoming damage, pause/hidden-tab resume, hacking, relays, Guardian phases, core extraction and replay. Record sustained FPS/frame time and device heat for ten minutes. Repeat low and medium, compare the original Phaser game on the same phone, and restart/exit repeatedly. Physical-device performance is not verified by desktop emulation.

## Handoff / incomplete replacement gates

This is a playable migration foundation, not approval to retire Phaser. Full Guardian/extraction/replay testing in Three, every attack/height/POV combination, extended camera collision testing, full touch combat, context-loss browser recovery, active-boss performance and long memory/thermal soaks remain validation work. NPC navigation is ground-floor only; future multi-floor vaults need explicit nav/connectivity validation. Side-view depth lanes are the conversion contract, rather than a claim that arbitrary saved vaults already support pure single-plane platforming. The active repository has no completed saved Vault Architect/async-rival system to convert. Production-ready human likenesses/environment art and physical-phone measurements are still required.

Do not trust sandbox results as account rewards, and do not migrate local practice XP into authoritative progression. A separate server validation design would be needed before economic/ranked outcomes. Continue reviewing small changes on `feature/rivals-3d-migration`; do not push or deploy without authorization.

See [test evidence and measured limitations](RIVALS_3D_QA.md).

## Character polish follow-up

The approved first character-polish phase replaces the experiment's temporary player with the supplied Universal humanoid and selected retargeted animations. See [character assets, runtime changes, final validation, screenshots and Prompt 2 handoff](RIVALS_3D_CHARACTER_POLISH.md). The earlier character-art and validation notes above describe the original migration baseline; the follow-up report records what changed and which final-art/full-heist gates remain.
