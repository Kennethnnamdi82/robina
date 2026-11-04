# RIVALS — requested control and HUD revision

Implemented on `feature/rivals-3d-migration`, following `src/TASK/GAME_VISION.md` and the user's latest control requirements. This revision supersedes the previous soldier report's HUD positions, camera menu, muted startup and manual mobile reload/switch controls.

## Actual changes

| Request | Result |
| --- | --- |
| Restore the direction box | The existing live minimap is permanently visible at the top right, including position, doors, the mission marker and compact live security timing. It is no longer hidden behind INTEL. |
| Sprint works with movement | Sprint activates on pointer-down and latches visibly. A second finger can engage it while the left stick retains pointer capture. Pause clears held input and the sprint latch. |
| VIEW changes camera immediately | Each activation cycles tactical → side → third person → first person → tactical. Switching preserves the raid, ammunition, health and world state. |
| Visible, usable zoom | Zoom sits beside VIEW, displays its target magnification, retains each perspective's preference and smoothly approaches the bounded target. |
| Right joystick fires accurately | The left stick exclusively supplies translation. The right stick controls aim and fire, including a stationary center press. It never rotates the camera. In FPS/TPS, the crosshair and first-person weapon follow the actual aiming ray. Releasing fire stops attacks. |
| Mobile camera look | Swiping the exposed playfield turns FPS/TPS cameras independently of both sticks. Mouse right-drag remains available. Pointer ownership prevents another finger's release from cancelling look. |
| Weapons at top left | Three directly selectable slots sit beneath health, with original gun/knife silhouettes, selection highlighting and per-slot ammunition. The separate SWITCH control is removed from the 3D HUD. |
| Automatic reload | An empty magazine begins reloading without another trigger press or an R command. It transfers ammunition from the existing finite reserve. The 3D RELOAD button is removed. |
| Sound starts with entry | ENTER/RESTART starts the audio buses synchronously inside the user gesture. The raid starts unmuted; mute and volume controls remain available. There is no requirement to tap the speaker first. |
| Hold to jump higher | A short press produces a normal jump. Holding adds bounded upward lift during the first 0.32 simulation seconds. The player can keep moving while holding jump. Gravity, head clearance, landing and no automatic repeated jump are retained. |
| Evade, rather than forward rush | The 3D controller uses a shorter evasive step. Movement across the aiming direction chooses a lateral evade; stationary or forward intent retreats. The actual supplied crouch clip and a directional lean replace the forward roll presentation. Original Phaser dash behavior remains the default. |
| More convincing grenade | An original olive-and-steel grenade replaces the glowing polyhedron. It has a segmented shell, fuse housing, lever, pin and ring, and appears before release. Existing gravity, collision, fuse, stock and shared target-damage adapters remain functional. The explosion adds a brief flash and pooled smoke plumes. |
| Brighter buildings | Brighter hemispheric, ambient and directional fill lighting exposes architecture and characters. World-scaled panel seams, vents and light strips add readable wall detail without additional panel draw calls. Existing supplied floor and equipment assets remain in use. |

The minimap, weapon slots, camera utilities and thumb controls are separated into consistent screen regions. Graphics, look sensitivity and audio mix are available in pause. Gameplay and mission simulation stop during pause or replacement dialogs.

## Main implementation files

- `three/SoldierHUD.tsx`, `three/SandboxApp.tsx`, `three/controlPress.ts`, `three/sandbox.css`: interactive silhouettes, simplified controls and responsive layout.
- `three/RaidRuntime.ts`, `three/CameraRig.ts`, `three/WeaponRig.ts`: independent aim/look ownership, camera framing, visible zoom and view-model aiming.
- `three/physics3d.ts`, `three/Loadout.ts`: bounded held jump and released-trigger automatic reload.
- `three/EquipmentArt.ts`, `three/FieldArt.ts`, `three/CombatEffects.ts`: actual grenade mesh, pre-release presentation and pooled explosion effects.
- `three/SandboxSession.ts`: audio initialization inside entry/restart gestures and disposal.
- `three/HumanoidAnimator.ts`, `scripts/prepare-rivals-humanoid.mjs`: selected genuine `Crouch_Fwd_Loop`, taking the prepared operative to 22 clips.
- Shared `characters/CharacterController.ts`: opt-in evasive movement; default Phaser behavior retained.
- Shared `ui/TouchStick.tsx` and `input/InputBuffer.ts`: optional pressed callback and read-only raw aiming accessors; existing callers retain their behavior.

## Verification

- Complete unit regression: **158 passed**, 31 files, 56.58 seconds.
- Final TypeScript checks: **passed**.
- ESLint: **0 errors**, nine existing fast-refresh warnings in unrelated shared UI/context files.
- Normal production build: **passed**, 2 minutes 41 seconds. Existing third-party PURE annotation and large vendor-chunk warnings remain.
- Complete Chrome browser regression: **17/17 passed**, 25.3 minutes. Final focused regression after the activation/timing refinements: **3/3 passed**, 4.5 minutes, including zoom and direct equipment selection while movement stays held, keyboard selection without unintended dodge, compact map timing and phone layouts.

New unit checks cover independent fire/movement/sprint, pause reset, lateral/backward evade with Phaser compatibility, held-jump height and ceiling clearance, automatic finite-reserve reload after fire release and smoothed zoom. Browser checks exercise actual pointer/touch input and read-only telemetry rather than modifying gameplay state to create results.

The existing map components also accept an optional compact timing caption for the 3D HUD; their Phaser defaults remain unchanged.

## Previews and local use

[Actual grenade mesh close-up](rivals-3d/controls-v2/grenade-detail.png). [Desktop FPS](rivals-3d/controls-v2/first-person.png), [desktop TPS](rivals-3d/controls-v2/third-person.png), [phone portrait](rivals-3d/controls-v2/phone-390x844.png), [small phone](rivals-3d/controls-v2/phone-320x568.png), [phone landscape](rivals-3d/controls-v2/phone-844x390.png) and [short landscape](rivals-3d/controls-v2/phone-568x320.png). [Actual jump/evade/grenade diagnostics](rivals-3d/controls-v2/jump-evade-grenade.json) record the measured movement and consumed grenade.

From `C:\Users\kenne\Documents\RIVALS\robina\robina`, run `npm run dev:rivals3d`. Open `http://localhost:8084/` on the laptop or the Network address printed by Vite on a phone using the same Wi-Fi. Refresh an already open page to receive the revised UI.

Desktop: WASD moves, Shift sprints, mouse fires/aims, right-drag looks, 1/2/3 selects equipment, J holds jump, Space evades, G throws, E interacts, V cycles view and Z cycles zoom. Mobile: left stick moves, right stick fires/aims, Sprint latches, Jump can be held, and the exposed playfield accepts camera-look swipes in FPS/TPS. Tap a gun/knife to equip it.

## Practical limits

The grenade is original game geometry, not a proprietary Call of Duty asset or a claim of equivalent AAA art quality. The supplied pack has no dedicated side/back evasive clips, so this revision uses its real crouch locomotion clip with procedural directional lean. Dedicated grenade throwing, FPS arms and rifle-specific handling artwork remain missing. Mobile Chrome emulation verifies touch behavior and layout; physical Android/iOS frame rate, audio balance and comfort still require testing on hardware.

This work changes the development game experience. No production deployment, database, authentication, PWA or account-entitlement operation was performed. User task-file changes were preserved.
