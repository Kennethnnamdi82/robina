# RIVALS — combat polish, Prompt 2

This phase continues the approved Three.js sandbox on `feature/rivals-3d-migration`, using `src/TASK/GAME_VISION.md` as product context. The existing vault-infiltration game, four cameras and Phase 1 operative remain the foundation. This is a combat presentation phase, not a city, inventory, economy or backend expansion.

## Defects and corrections

| Observed cause | Implemented correction |
| --- | --- |
| Old weapons were centered using bounding boxes, with an approximate torso/wrist offset and inconsistent axes. | Selected supplied models are converted to metres, grip-origin pivots and -Z forward; explicit grip, support, muzzle, ejection and sight markers accompany each model. |
| The source aim animation is pistol-oriented and does not place the second hand on a rifle. | Two lightweight analytic arm solves place the actual wrist/palm sockets on the right grip and left foregrip. Temporary roll, hit, death and reload clips retain control of the arms; equipment stays attached to the right hand throughout. |
| Shots began at a fixed chest-height point, unrelated to equipment. | Authoritative projectiles start at the actual animated muzzle. A body-to-barrel sweep clamps an obstructed origin before the wall; camera-based aim is converted to a muzzle-to-target direction. |
| Small bullet spheres disappeared between frames and did not clearly show the firing path. | Real swept projectile segments feed bounded, short-lived tracer meshes. Actual firing/impact callbacks drive supplied flash, smoke and impact textures. |
| Recoil also changed the camera ray used for aim. | Aim is sampled before a small optional render-only kick; weapon recoil and return are cosmetic. Accuracy, spread and damage are unchanged. |
| The rifle used a generic old firing cue and reload visuals assumed 1.8 seconds. | Real edited firearm recordings feed a bounded Web Audio bus; reload animation and start/completion foley follow the existing 1.25-second reload. |
| Security `Death_Fall` clips bend joints without carrying the whole rigid body to the floor; their final torso fold also leaves a raised corpse after a root fall. | A one-way death presentation cancels incompatible actions, plays the supplied nonlooping clip, completes a directional root fall, relaxes the torso/head into a grounded rest and fades the corpse between 8 and 10 simulation seconds. |
| Hit state alone could not reliably distinguish each newly accepted hit from ongoing hurt time. | Accepted damage events explicitly trigger a short directional flinch/material response. Dead presentations reject later hit reactions. |

## Selected assets and licensing

No asset downloads, new dependencies or raw-pack changes are required. The converter uses the supplied OBJ/MTL files; duplicate FBX and Blend versions remain source alternatives.

| Runtime use | Actual supplied asset |
| --- | --- |
| Existing PULSE CARBINE; heavy security and Guardian equipment | Quaternius `AssaultRifle2_1`, 1,930 triangles, 3 materials, 0.82 m |
| Enforcer equipment presentation | Quaternius `SubmachineGun_3`, 1,566 triangles, 4 materials, 0.61 m |
| Guard equipment presentation | Quaternius `Pistol_4`, 1,320 triangles, 3 materials, 0.30 m |
| Rifle fire, two variants | Free Firearm Sound Library, AR-15 `D_32P` / `D_24P` |
| Pistol fire, two variants | 1911 `A_42P` / `A_34P` |
| SMG fire, two variants | Carl Gustav M45 `G_20P` / `G_22P` |
| Existing Guardian blast layer | Mossberg `N_26P`, filtered/slowed with metal foley; no shotgun inventory or entitlement is introduced |
| Walking, surface impacts, reload/click, damage and collapse | Eight selected Kenney Impact Sounds OGG files |
| Flash, smoke, blast | Three selected Kenney particle images, prepared as 128-pixel WebP |

Publisher license references: [Quaternius Ultimate Guns](https://quaternius.com/packs/ultimategun.html), [Free Firearm Sound Library](https://lpc.opengameart.org/content/the-free-firearm-sound-library), [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), [Kenney Smoke Particles](https://kenney.nl/assets/smoke-particles). These sources identify the selected packs as CC0. The firearm library credits Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney.

`public/assets/rivals/combat3d/CREDITS.txt` and `manifest.json` preserve source attribution, exact files, preparation details, sizes and SHA-256. The selected 21 runtime files total **835,518 bytes (about 816 KiB)**, excluding the small manifest/credits. Raw audio, PNG, OBJ, FBX and Blend packs are ignored and never served by the game as runtime dependencies.

Gun recordings retain a short attack/decay, are folded to mono, high-pass filtered at 65 Hz, peak-normalized to 0.82 and tail-faded. Final playback uses compression and controlled gain. Reload, empty click and collapse are impact-foley constructions, not newly recorded weapon handling or character vocals. The blast is a designed layer, not a field explosion recording.

## Architecture and ownership

- `ArmIK.ts`: bounded analytic two-bone solve; transforms only visual bones, never physical movement.
- `WeaponRig.ts`: animated right-hand attachment, left-hand support, axis validation, named sockets, recoil, barrel obstruction check and a separate first-person weapon view.
- `CombatEffects.ts`: fixed 40-sprite/48-tracer storage; active budgets scale with graphics quality. New flashes survive their first render frame. Shared texture resources belong to `RaidAssets`.
- `CombatAudio.ts`: lazy user-gesture unlock; cached decoded buffers; maximum 16 combat voices; priority/oldest eviction, distance attenuation, stereo pan, mute/volume/pause and abort/disconnect/close cleanup. Old ambient/objective/security audio remains in its existing adapter.
- `SecurityPresentation.ts`: per-actor material ownership, accepted-hit feedback, one-way death latch, supplied animation, visual floor correction and corpse fade. Gameplay health, decisions, collision eligibility, death counts and rewards stay in existing controllers.
- `RaidAssets.ts`: prepared weapon loading; caches rigid security hand geometry position before batching; loads only three small effect textures.
- `RaidRuntime.ts`: fixed-step animation sampling before muzzle calculation; connects actual firing, reload, impact, movement, damage, boss pulse and death events. Read-only diagnostics make these paths testable without gameplay bypasses.
- `HumanoidAnimator.ts`: existing layered animation, now using the real reload duration.
- `Projectile3D.ts`: preserves the swept hit/damage rules and exposes the actual travelled segment and original muzzle point to effects.
- `SandboxApp.tsx` / `sandbox.css`: scoped pause audio mixer and combat diagnostics. The existing controls and game UI remain available.
- `scripts/prepare-rivals-3d-combat.mjs`: repeatable selected-asset preparation; the original Phaser combat preparation script remains intact.

The first-person weapon uses a second render pass in the existing renderer, so city walls cannot clip through the view model. Its sight marker aligns to camera center during ADS. A small shared 64-pixel reflection atlas improves metal readability only on equipment. Its render target, effect materials/geometry, instance materials, audio nodes, skeletons, mixers, listeners and renderer are released on exit.

The existing carbine remains 25 damage, 0.16-second firing interval, 12-round magazine and 1.25-second reload. No new player weapon unlocks, ammunition rules or enemy damage/cooldown values are introduced. Guard/enforcer/heavy weapon models are presentation choices for their existing attacks. Guardian phase thresholds, shield rules, telegraphs, mission events and reward rules are retained.

## Verification

| Final check | Result |
| --- | --- |
| `npm test` | **136 passed**, 29 files, 52.01 seconds |
| Focused 3D regression | **25 passed**, including the four actual supplied guard/enforcer/heavy/Guardian death assets and paused-corpse behavior |
| `npx playwright test --config playwright.rivals3d.config.ts` | **10 passed**, 7.0 minutes, final isolated run |
| `npm run typecheck` | **Passed**, application and Node configurations |
| `npm run lint` | **0 errors**, 9 pre-existing fast-refresh warnings in shared UI/context files |
| Final targeted ESLint over 3D code, tests and preparation script | **Passed**, no warnings/errors |
| `npm run build` | **Passed**, 2 minutes 12 seconds; existing third-party PURE annotation and large vendor-chunk warnings remain |
| `node scripts/verify-rivals3d-gate.mjs` | **Passed**: missing flag gives HTTP 404; experimental deployment build is rejected |
| Prepared-asset integrity | **21/21 SHA-256 values and byte sizes match** the manifest |
| Normal production JS audit | **Passed**: no sandbox entry or raw-pack source paths in production JS |
| Branch / whitespace check | `feature/rivals-3d-migration`; `git diff --check` passed |

The browser tests cover actual hand/support sockets, muzzle origins, firing in all four POVs, centered FPS ADS sights, reload, real decoded audio output, mute, actual movement/jump/dodge and collision, three-finger move/aim/fire, local HTTP LAN entry without account services, pause, repeated restarts/exits and original Phaser launch/playability. The final full unit run includes the final torso-settling, animation-twist and pause corrections. Early browser checks exposed a raised corpse, an un-warmed GPU baseline and timing assumptions in the test harness; these were corrected before the final passing run. No failed assertion was removed to hide the corpse defect.

The real guard test applied **three accepted 25-damage hits**, observed **one death**, verified that firing stopped and collision was disabled, then observed corpse cleanup without another death/reward transition. Its settled height was **0.464 m**, with floor error below **0.000001 m**. The supplied Guardian death geometry/clip is exercised in the pose regression; the final browser run does not claim a full Guardian-to-extraction mission.

During **36+ actual shots and automatic reloads**, GPU registrations remained **17 geometries / 15 textures**, matching the warmed baseline. Tracer/particle pools expired after firing. This checks bounded resources for that sequence, not an unbounded-duration heap-leak guarantee. The audio test decoded all 15 selected buffers, resumed its AudioContext from a real gesture and measured nonzero output without load errors. Final speaker/headphone balance still requires listening on target devices.

These browser captures use desktop Chrome and Chrome mobile emulation with software WebGL. The test host reported roughly 4–7 FPS in the captured scenes; these are not Android/iOS GPU performance measurements. Physical-device profiling and final visual fidelity remain open.

Saved evidence:

- [Tactical weapon](rivals-3d/combat/tactical-weapon.png), [side weapon](rivals-3d/combat/side-weapon.png), [third-person weapon](rivals-3d/combat/third-weapon.png).
- [First-person weapon](rivals-3d/combat/first-weapon.png), [ADS sight alignment](rivals-3d/combat/first-ads.png), [defeated guard](rivals-3d/combat/guard-defeated.png).
- [Emulated mobile portrait](rivals-3d/combat/mobile-portrait.png), [emulated mobile landscape](rivals-3d/combat/mobile-landscape.png).
- [Actual diagnostics and resource snapshots](rivals-3d/combat/verification.json).

Only the experimental frontend adapters, selected prepared assets, preparation tooling, scoped UI, tests, ignores and this report were changed in this phase. The original Phaser preparation script remains byte-equivalent to its tracked source. Existing unrelated working-tree changes, including the user's task document, were preserved. No database, production deployment, authentication, PWA, payment or account progression operation occurred. No commit, push or branch switch was performed.

## Local desktop and phone test

From a terminal:

```bat
cd C:\Users\kenne\Documents\RIVALS\robina\robina
npm run dev:rivals3d
```

Open `http://localhost:8084/` on the laptop. On a phone connected to the same network, use the **Network** URL printed by Vite, currently `http://10.147.47.72:8084/`. Keep the terminal running. The sandbox needs no wallet, Google sign-in, backend or account credentials. Allow the local Node process on the Windows private network if Windows prompts. This development entry is explicitly gated and rejects production builds.

Click **ENTER 3D RAID**. Desktop: WASD move, mouse aim/click fire, R reload, Space dodge, J jump, E interact; V or the POV menu changes camera, C switches FPS/TPS, right-drag looks, ADS button/right mouse narrows the first-person view. Mobile: left stick moves, right stick aims, right-side Fire fires; jump, dodge, ADS and POV controls remain available. Enable audio using the speaker button; the pause menu provides master/music/combat volumes and mute. Audio starts muted and requires a user gesture.

## Asset limits and next-phase handoff

There is no compatible authored first-person arm rig in these packs. The view model is an aligned weapon; it does not claim animated FPS arms. Dedicated rifle handling, magazine insertion, finger grips and rifle-specific hit/reload animations still need authored clips. Reload currently uses the real supplied pistol clip, retimed to gameplay, with derived weapon handling. No physical magazine is discarded or fabricated.

The supplied rigid security rigs retain their original visual style and are not newly authored premium human enemies. Their falls combine the supplied animation with a deterministic grounded root correction, not a ragdoll. The Quaternius guns use their supplied low-poly geometry and material colors; bespoke RIVALS weapon skins and texture detail remain future art work. The operative remains the Phase 1 development suit, not final VEX armor. City art and lighting are intentionally outside this phase. These asset/presentation limits prevent claiming an exact match to the cinematic target.

The implemented combat foundation is ready for Prompt 3, with the asset and physical-device checks above carried forward. Do not advance phases automatically.

Continue Prompt 3 from these adapters and the existing controllers. Reuse named equipment sockets and accepted gameplay events; do not tie damage to decorative sprites or first-person overlay meshes. Keep new guns cosmetic unless a future approved phase explicitly adds gameplay definitions and entitlements. Physical Android/iOS audio balance, simultaneous-touch comfort and GPU performance need device testing; Chrome touch emulation is not a phone performance certification. A complete Guardian-to-extraction mission replay is also separate from focused combat/state tests.
