# RIVALS — character polish phase 1

This work continues the approved four-POV Three.js experiment on `feature/rivals-3d-migration`. The supplied game vision remains the product context: futuristic operatives, readable mobile action, skill-based vault infiltration and fair gameplay. It does not authorize advancing to weapons, city redesign, economy, multiplayer or Vault Architect implementation.

## Audit and root causes

- The earlier player GLB was a converted cowboy/Mixamo model. Its forward walk and run were both derived from a reversed backward FBX, with a fixed idle upper body. Run playback was hardcoded to 1.7 rather than measured movement.
- The old actor adapter used a jump as its evade clip, tilted the torso and switched immediately out when the short dodge movement ended.
- Animation followed requested controller velocity, so a blocked character could continue running in place. Rendering and animation also used a different time budget from the fixed-step simulation during slow frames.
- Model forward required an extra half-turn in the old human loader. Reusing those assumptions for a +Z Universal model would reverse facing.
- The original equipment rotation was frozen from an arbitrary initial hand pose. A wrist bone's axis is not necessarily a weapon's barrel axis.
- In screenshot review a nearby wall could push the third-person camera inside the torso. A collision-tested elevated shoulder position now handles that case.
- The reused rigid-mesh batcher can discard source meshes when material groups have incompatible UV/normal attributes. The experimental loader now batches only compatible layouts and preserves the rest, including supplied weapon and security details.

The audit preceded implementation. Previous uncommitted migration and LAN-access work was preserved. No branch was created/switched, and no push/deployment or database operation occurred. The production app, authentication, backend, payments, PWA and Phaser implementation were not changed in this phase.

## Supplied assets

Both locally supplied Universal packs are CC0, by Quaternius. The source license files are copied alongside the prepared model. No downloads, paid assets or new dependencies are needed.

- **Universal Base Characters [Standard]:** male and female glTF + external buffers/textures, and FBX variants. Both glTF rigs have 65 joints. The selected male full-body model provides real skinned body, eyes and eyebrows. The female is inspected but is not presented as a completed NYX implementation.
- **Universal Animation Library [Standard]:** 43 clips in the standard non-root-motion GLB, plus a separate root-motion variant and FBX exports. Runtime preparation selects the non-root-motion file.
- The existing guard/enforcer/heavy/Guardian models are rigid animated hierarchies with no glTF skin; each already provides nine clips. They are not the Universal humanoid skeleton and are deliberately retained on their own independent animation adapters. Their AI/combat/death behavior is not replaced. The new humanoid infrastructure can be reused with another compatible rig without sharing a mixer or mutable actions.

`scripts/prepare-rivals-humanoid.mjs` prepares only one runtime GLB. It validates matching bone names, samples the source T-pose reference, transfers world-rest rotation deltas to the target hierarchy and retains target bone lengths. Horizontal root travel is removed; the existing physical body owns movement. Vertical pelvis bob is retained. Output height is 1.75 m, feet use the physical origin, +Z is forward, and original skin weights/UVs are preserved.

Two supplied normal-map URLs have an erroneous `_png` suffix. The preparation loader resolves these to the existing normal files, without editing the source pack. Original base-color, normal and roughness maps remain, embedded as WebP at up to 1024 px. The selected mesh receives a dark field-suit vertex tint and a head-attached cyan visor. This is a development operative finish; it is not newly authored final VEX armor or final target likeness.

Prepared output: **2,456,440 bytes**, **14,330 triangles**, **65 bones**, **17 selected clips**. Before texture compression it was approximately 8.25 MB. The manifest records exact clip durations, source paths and SHA-256. Raw source packs remain local/ignored; the game loads the prepared GLB, never the entire animation library.

## Animation coverage

| Intent | Actual supplied clip / behavior |
| --- | --- |
| Idle / combat ready | `Idle_Loop`, `Pistol_Idle_Loop` |
| Walk | `Walk_Loop` |
| Jog / normal fast run | `Jog_Fwd_Loop`, playback matched to physical speed |
| Sprint | `Sprint_Loop` |
| Retreat / strafe | Derived from genuine locomotion clips using reverse playback and bounded leg/chest steering; no separately authored directional clips are claimed |
| Start / stop / turn | Short controlled blends, acceleration-aware gait and damped facing; no authored start/stop/turn clips are supplied |
| Jump / air / landing | `Jump_Start`, `Jump_Loop`, `Jump_Land`, tied to actual grounded/vertical state |
| Dodge | `Roll`, timed to the existing 0.18 s travel plus 0.10 s recovery |
| Aim | `Pistol_Aim_Neutral`; up/down pose clips are prepared for later integration |
| Shooting / reload | Upper-body `Pistol_Shoot`, `Pistol_Reload`, driven by existing shot count/reload time |
| Hit / death compatibility | `Hit_Chest`, `Death01`; no new death/reward/game-over system |
| Future interaction compatibility | `Interact` is prepared; the existing interaction gameplay is retained |

There is no dedicated authored backward walk, lateral strafe, separate run, movement start/stop, turn-in-place or rifle aim clip in the supplied Standard library. These are asset limitations, not hidden completed features. Pistol-derived aim is a temporary stance for the existing rifle; authored two-hand grips, rifle-specific upper-body animation and first-person arms belong to Prompt 2. The short existing roll/jump timings require accelerated one-shots; their playback durations are explicit, not changes to gameplay balance.

## Runtime architecture

- `HumanoidAnimator.ts`: one mixer per humanoid; cached action bank; bounded crossfades; disjoint lower/upper tracks during locomotion; aim/fire/reload without restarting the stepping cycle; full-body jump/roll/hit/death compatibility. Temporary states recover to the current intent, using simulation delta. Playback follows collision-resolved X/Z travel, not input magnitude alone. Real source stepping drives the legs.
- Facing uses the verified +Z model axis and damped shortest-angle turns. Side mode uses left/right facing. The body is hidden in FPS, with a 1.62 m eye position. POV changes retain the same actor, mixer, action phase, mission, health and ammunition.
- `dodgeMotion.ts`: a smooth acceleration/coast/brake profile with unit integral preserves the existing active dodge distance (2.79 m), duration, cooldown and immunity. The same kinematic collision solver handles every movement substep. The 3D adapter rejects airborne roll requests and simultaneous jump/roll launches; the shared Phaser controller is unchanged.
- `RaidRuntime.ts`: wires real movement, grounded state, damage/shot serials and aim intent into the animator. Read-only diagnostic fields expose selected motion, recent transitions, actual speed, action time, leg rotation, hand-socket position and visibility for browser verification.
- The right/left hand sockets are children of the actual hand bones. Wrist calibration samples the authored neutral aim pose once, then stores a local equipment rotation. Chest, shoulders and head are also identified. No weapon is fixed beside the player in world space.
- `RaidAssets.ts`: owns the shared immutable model/geometry/materials/textures. Each clone owns its skeleton and actions. Exit stops and uncaches the mixer, disposes instance skeleton textures and lets the asset owner dispose shared resources. POV changes never allocate a new scene or mixer.
- Low/Medium/High settings, the guest LAN entry, missions, security, weapons, AI and Phaser fallback remain available. No authentication or progression writes are introduced.

## Validation

Desktop Chrome mobile emulation is not a physical-device benchmark. The machine uses a software WebGL driver, so it cannot certify the mobile FPS target. The larger source-mesh preservation can increase draw calls; final physical-device profiling remains required.

| Check | Actual result |
| --- | --- |
| Complete frontend unit regression | **128 passed**, 28 files, 236.89 s |
| Final focused animation/physics/camera regression | **17 passed**, 2 files, 9.49 s; includes the final gait-cache correction |
| Complete 3D browser suite | **8 passed**, 5.2 min |
| Final expanded touch gait regression | **1 passed**, 22.6 s; verifies slow-to-fast aimed retreat selects the actual correct clip, then sprint/aim and exit |
| Application and Node TypeScript | **Passed**, including final clip diagnostics |
| ESLint | **0 errors**, 9 existing shared UI/context Fast Refresh warnings; final changed-source/character-test lint also passed |
| Normal production build | **Passed**, 3 min 1 s; existing vendor/PURE-annotation and large-chunk warnings remain |
| Development-only gate | **Passed**: missing explicit flag returns 404; sandbox deployment build is rejected |
| Production JavaScript exclusion audit | **0** experimental character/runtime matches in `dist/assets/*.js`; prepared art is a static public asset |
| Preparation script syntax / Git whitespace | **Passed** |
| Actual physical Android/iOS performance | **Not verified**; no physical-device FPS claim |

The tests cover real skeletal leg motion and speed changes, analog walk/jog/run/sprint, simultaneous move/aim touch pointers, jump/fall/landing, repeated rolls/cooldown, collision while rolling into the closed transit gate, all four POVs, state continuity, FPS body hiding, pause, restart and exit. Existing browser regression covers actual guard damage, mission interactions, low/medium quality controls, resizing, the HTTP LAN entry and original Phaser launch.

The first combined browser run passed 7 of 8 cases; one new jump test polled after the short jump had already completed on the slow host. A subsequent cooldown assertion similarly allowed more than the real cooldown to pass between host commands. The automation now observes game time and releases movement inside the browser; no movement speeds, cooldowns or jump parameters were weakened to satisfy tests.

The final added touch case also caught an action-bank issue: a directional state could reuse its first slow clip after the requested gait changed. Actions are now keyed by both motion and actual source clip, with coverage from slow retreat to fast retreat and sprint. The touch setup returns to the starting area using real traversal before sprinting, so an accumulated trip to the south wall does not invalidate the speed assertion. All final focused checks passed after these corrections.

Screenshots from the actual raid: [tactical](rivals-3d/character-polish/tactical.png), [side profile](rivals-3d/character-polish/side.png), [third person](rivals-3d/character-polish/third.png), [first person](rivals-3d/character-polish/first.png), [touch movement and aim](rivals-3d/character-polish/touch-sprint-aim.png). These show the implemented development art and the existing environment; they are not the final visual target.

## Changed files in this phase

- `src/features/rivals/three/HumanoidAnimator.ts`, `dodgeMotion.ts`, `HumanoidAnimator.test.ts`: character animation, sockets, shaped dodge travel and deterministic regression.
- `src/features/rivals/three/RaidRuntime.ts`, `RaidAssets.ts`, `CameraRig.ts`, `SandboxApp.tsx`, `migration.test.ts`: integration, safe model loading, camera comfort, read-only diagnostics and collision/camera regression.
- `scripts/prepare-rivals-humanoid.mjs`, `public/assets/rivals/characters/*`: reproducible selected asset preparation, manifest and licenses.
- `tests/rivals3d/character.spec.ts`: actual-raid keyboard, touch, collision, camera and lifecycle scenarios.
- `.gitignore`, `package.json`: keep source packs out of runtime/commits, expose the preparation command.
- This report and `docs/rivals-3d/character-polish/`: handoff and actual screenshots.

Earlier migration/LAN fixes shown in the working tree are pre-existing work from this conversation; they were not removed or rewritten.

## Local testing and next phase

From `robina/robina`:

```sh
npm run dev:rivals3d
```

Open the printed Network URL on a phone on the same network. The current address is `http://10.147.47.72:8084/`; use the printed address if Wi-Fi changes. The lobby's **ENTER 3D RAID** button launches the actual raid without login. Refresh an already-open tab after this upgrade. No backend is needed for the sandbox.

WASD moves; Shift sprints; Space rolls; J jumps; V cycles POVs; C switches FPS/TPS; right-drag looks; Z changes zoom. On mobile use the left movement stick, right aim stick and existing sprint/roll/jump/fire controls. Check movement from low analog input to full sprint, then release: the legs should step and return to idle. Try a closed door while rolling; it must remain solid. Switch POVs while moving or airborne. Pause and exit before repeating.

To reproduce preparation with the supplied source packs present:

```sh
npm run prepare:rivals:humanoid
```

Prompt 2 can consume the hand/chest/shoulder sockets, upper-body animation layer and existing shot/hit/reload events. Remaining art dependencies are final VEX/NYX/ROOK geometry/armor, proper rifle grips/stance, first-person arms, and authored directional/start/stop/turn animations. No full weapon/audio, enemy death/boss or city overhaul was started. The earlier full Guardian-to-extraction migration gate remains outstanding; this phase's movement/combat checks do not certify an entire successful heist.
