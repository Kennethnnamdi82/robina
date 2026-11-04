# RIVALS — soldier controls, firing and HUD

The latest control and HUD revision is documented in [RIVALS_3D_CONTROL_REVISION.md](RIVALS_3D_CONTROL_REVISION.md); the following records the previous implementation.

Implementation on `feature/rivals-3d-migration`, using `src/TASK/GAME_VISION.md` as product context. The approved Three.js raid, original Phaser fallback, account systems and existing mission remain in place.

## Existing features enhanced

| Feature | Actual change |
| --- | --- |
| Muzzle firing | World flashes are children of the current muzzle socket, rather than particles abandoned at a sampled world position. Recoil, arm animation and movement carry the flash with the gun. FPS shots originate at the rendered view-model muzzle transformed into the real world; the existing barrel-to-body obstruction sweep still prevents firing through walls. |
| Projectile presentation | One tapered, warm projectile streak represents each real swept projectile. Repeated physics samples update that same streak instead of allocating a train of cyan dash meshes. Flashes combine a directional plume and the supplied texture; smoke and real impacts remain pooled. No decorative hit can independently apply damage. |
| Movement and aim | Existing joystick ownership, normalized movement, kinematic collision and four-camera conversion are retained. The 3D session opts into aim-stick automatic fire. Releasing aim stops continuous attacks; releasing movement stops the touch-driven soldier without residual acceleration. Desktop input remains available. |
| Ammunition | Existing `WeaponController` now optionally accepts finite reserve/max-reserve values. Reload transfers only the missing magazine rounds that are available in reserve. Existing Phaser callers keep their original unlimited-reserve default. |
| Animation | Existing layered mixer and hand sockets now select the actual supplied `Sword_Idle`, `Sword_Attack`, `PickUp_Table` and `Spell_Simple_Shoot` clips, in addition to the previous 17 clips. First-person knife slashes and weapon lowering use controlled view-model motion. |
| HUD | Existing health/objective/audio/pause components and action buttons are reused. A compact loadout/ammunition dock replaces competing weapon readouts. Camera, zoom, quick FPS/TPS and graphics/sensitivity controls share one blocking optics menu. Security/map detail is available through INTEL. Diagnostic output remains available to tests but is hidden from the playfield. |

## Missing features implemented

- Three persistent weapon slots, initially **PULSE CARBINE / KESTREL pistol / FIELD KNIFE**. Switching never creates a world drop or resets another slot's ammunition. Q cycles; 1/2/3 selects a slot. Reload cancellation on switching transfers no rounds.
- A real knife attack with a 1.8 m directional cone, 45 damage, physical cover checks and a 0.55-second cooldown. It consumes no ammunition and cannot reload. The existing enemy damage/death adapters process accepted hits.
- Configurable enemy weapon drops: guard → pistol, enforcer → SMG, heavy → rifle. Each defeated enemy also drops a small health box. The Guardian unlock event can provide a large health box. Source IDs prevent repeated death notifications from duplicating drops.
- Interactable 3D pickups with proximity/cover checks, visible markers and names. Empty slots fill directly. A full loadout opens **Replace weapon**; only the explicitly selected slot changes. Cancel leaves both pickup and inventory intact. Collection consumes the pickup only after success.
- Separate pulse-charge stock, a throw action with delayed release, a bounded 3D bomb pool, gravity, world collision, fuse, explosion effects/audio, radius/cover checks and one damage event per eligible target. Bombs never occupy weapon slots.
- Health boxes use the existing `Health` instance and configurable **20 / 40 / 75 HP** values. Healing clamps at maximum and reports the actual gain. Full-health and dead players cannot consume a box. The original med charge also remains available and is preserved at full health.

The existing carbine retains its 25 damage, 12-round magazine, 0.16-second interval and 1.25-second reload. Pistol/SMG definitions reuse the existing Rugfire weapon data. No weapon purchases, account entitlements, matchmaking or new reward persistence were added.

## UI layout

- Top left: health and current mission objective.
- Top right: clock, sound, pause, optics and optional field intelligence.
- Lower center: three weapon slots, selected weapon, magazine and reserve.
- Mobile lower left: movement, sprint, dodge and jump.
- Mobile lower right: aim/fire stick, reload, weapon switch, charge quantity and contextual ADS.
- Between sticks: interaction only when relevant. Pickup text appears only near eligible equipment.

The manual Fire button remains available on desktop; the mobile right stick performs aiming and firing together. Portrait layouts keep the central action area open. Short portrait screens move the weapon dock below the objective; 320-pixel screens place jump above the left action row to avoid intersecting the right controls. Safe-area offsets and minimum combat-button dimensions are respected. Menus clear held input and stop the simulation clock.

## Important files

- `three/Loadout.ts`: per-slot weapon state and action timing, using the existing controller.
- `three/FieldItems.ts`: configurable pickups, consumption, bomb simulation and melee damage.
- `three/FieldArt.ts`, `three/EquipmentArt.ts`: scene representations and ownership. Existing authored guns and health-kit assets are reused; the small knife and pulse charge are original geometry because compatible supplied 3D versions were absent.
- `three/CombatEffects.ts`, `three/WeaponRig.ts`, `three/RaidRuntime.ts`: live muzzle flashes, continuous projectiles, view-model actions and integrated raid events.
- `three/SoldierHUD.tsx`, `three/SandboxApp.tsx`, `three/sandbox.css`: scoped loadout, existing controls and responsive HUD.
- `three/HumanoidAnimator.ts`, `three/RaidAssets.ts`, `scripts/prepare-rivals-humanoid.mjs`: additional real animation clips and existing asset ownership. Prepared operative: **2,781,572 bytes**, 21 selected clips; geometry and skin are retained.
- Shared `combat/weapons.ts`, `input/InputBuffer.ts`, `core/contracts.ts`, `ui/ActionControls.tsx`: small opt-in extensions; default Phaser behavior remains compatible.
- `three/Soldier.test.ts`, `tests/rivals3d/soldier.spec.ts`: focused rule and actual-input regressions. Existing camera/animation/fallback checks remain enabled.

## Verification

- Complete unit regression: **151 passed**, 30 files, 95.66 seconds.
- Application and Node TypeScript: **passed**.
- ESLint: **0 errors**, nine pre-existing fast-refresh warnings in shared UI/context files.
- Normal production build: **passed**, 3 minutes 18 seconds. Existing third-party PURE annotations and vendor-chunk size warnings remain.
- Development-only gate: **passed**; missing explicit flag returns HTTP 404 and sandbox deployment builds are rejected.
- Branch and whitespace checks: `feature/rivals-3d-migration`; `git diff --check` passed.
- Browser regression: **all 14 distinct scenarios validated**, using the complete regression followed by focused correction reruns. The final phone-entry, dual-stick and real knife/drop/heal rerun passed **3/3** (3.1 minutes); the final four-POV HUD and mobile ADS/layout rerun passed **2/2** (2.6 minutes). No unresolved browser test failures remain. The earlier full run exposed an obsolete mobile Fire-button assertion, a 10-pixel spacing boundary and a test assuming a weapon would be collected before a closer medkit; those were corrected and rechecked.
- Touch layouts checked at **320 ? 568, 360 ? 640, 390 ? 844 and 844 ? 390**, including simultaneous real Chrome touch points, release-to-stop behavior, visible button bounds and overlap checks. Mobile TPS adds the ADS button to the portrait layout checks.

Live rendered firing was also inspected across eight consecutive canvas frames. The actual muzzle flash is visible at the barrel in the captured firing frames; read-only socket error was zero throughout this capture. [Live firing frame](rivals-3d/soldier/live-muzzle-fire.png) and [capture diagnostics](rivals-3d/soldier/live-fire-diagnostics.json).

Saved actual gameplay previews: [FPS](rivals-3d/soldier/first-hud.png), [TPS](rivals-3d/soldier/third-hud.png), [tactical](rivals-3d/soldier/tactical-hud.png), [side](rivals-3d/soldier/side-hud.png), [phone portrait](rivals-3d/soldier/mobile-390x844.png), [small phone](rivals-3d/soldier/mobile-320x568.png), [phone landscape](rivals-3d/soldier/mobile-landscape.png) and [real knife defeat](rivals-3d/soldier/knife-guard-defeated.png). [Read-only gameplay diagnostics](rivals-3d/soldier/knife-and-heal.json) record the collected enemy drop and successful healing.

Unit tests cover reserve transfers, no ammo creation, persistent slots, cancelled reloads, explicit replacement/cancel, dead/blocked restrictions, knife direction/range/cover/cooldown, health clamping/full-health preservation, duplicate drops, bomb capacity/trajectory/cover/one-hit behavior, touch-fire release, live socket following and one continuous projectile visual per shot. Browser tests use actual DOM/Chrome touch input and read-only telemetry, rather than modifying health or inventory to manufacture successful gameplay.

## Local run and controls

```bat
cd C:\Users\kenne\Documents\RIVALS\robina\robina
npm run dev:rivals3d
```

Laptop: `http://localhost:8084/`. Phone: use the **Network** URL printed by Vite while both devices are on the same network. This development raid requires no wallet, Google sign-in or backend account service. Audio starts muted; enable it with the speaker button.

Desktop: WASD movement, mouse aim/fire, R reload, Q weapon cycle, 1/2/3 slot select, G charge, E collect/interact, Space dodge, J jump, V POV and C FPS/TPS. Right-drag looks; ADS is available for firearms. Mobile: left stick moves, right stick aims and automatically fires; release the right stick to stop. Reload/switch/charge sit above the right stick. Camera/settings are under VIEW.

## Remaining asset and verification limits

There is no dedicated grenade-throw animation, authored FPS arm rig or rifle-specific handling set in the supplied packs. The actual spell-shoot clip is adapted to the throw timing, and the weapon lowers in FPS; this is not claimed as an authored grenade animation. Existing pistol-derived rifle handling remains supplemented by the verified hand/foregrip solver. The knife and pulse charge are functional original small models, not newly supplied commercial art. Bespoke character armor, weapon skins and exact cinematic-reference fidelity remain art work beyond this implementation.

Chrome mobile emulation checks touch and layout; it does not certify real Android/iOS frame rate, audio balance, thermal behavior or safe-area hardware. Physical-phone testing remains necessary. No production deployment, database, authentication or PWA operation was performed. Existing user task-document changes were preserved.
