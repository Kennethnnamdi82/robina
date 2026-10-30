# Combined prompt 1 — verification and measured limits

The browser tests use the actual GamingPage and Phaser scene through the isolated QA entry, in React StrictMode. They do not bypass production authentication in the shipped application. Chrome 155.0.8059.85 on the available Windows host was used for desktop, 390×844 mobile portrait and 844×390 landscape emulation.

## Results

| Check | Result |
| --- | --- |
| Frontend unit suite | **58 tests passed, 19 files**, 26.61 seconds. Covers existing app tests, controller movement/state rules, normalized diagonals, sprint/dodge timing, input buffering and disposal, hybrid aim priority, settings integrity, audio gains/lifecycle, and real asset integrity. |
| Backend tests | **12 passed**, 5.78 seconds. Existing auth identity, session version, pricing/multiplier logic, local HTTP readiness/CORS, and periodic-worker tests. No MongoDB connection or database migration was performed. |
| Initial integrated browser suite | **14 passed / 1 failed**, 12.8 minutes. The remaining restart assertion incorrectly assumed Phaser could not reuse its pooled canvas. |
| Final focused browser regression | **8 passed / 0 failed**, 3.8 minutes. Covers updated restart identity/reset checks, movement and fast-dodge collision, sprint/diagonal/aim/cooldown, damage/death and text focus, mobile multitouch and control visibility, menu/settings persistence, real objective progress, and explicit audio-resource disposal. |
| Distinct browser scenarios verified | **16 across the main and focused runs.** This is not a claim of one clean sixteen-test invocation. |
| TypeScript | **Passed**, both application and Node configurations, after the final public-API cleanup correction. |
| Repository ESLint | **Exit 0, zero errors, nine existing Fast Refresh warnings** in shared UI/context files. Focused game/config/test lint also exits 0 without output. |
| Minified isolated QA build | Passed, final gameplay regression build 46.32 seconds. Phaser-containing chunk-size warning remains. |
| Production build | **Passed**, 10,264 modules, 3 minutes 43 seconds, using existing public configuration in `src/.env`. Final source includes the public-API cleanup correction. Details are recorded in [verification.json](rivals-combined01/verification.json). No production gate bypass or fabricated credentials were used. |

The backend initially had no installed dependencies, so two test files could not import Express/Mongoose. Its existing lockfile dependencies were installed with `npm ci --ignore-scripts`, and all twelve tests then passed. Backend source/manifests were not edited.

One QA build hit a local memory-allocation failure while large compilation work overlapped. It was rerun successfully with compiler worker limits and heavyweight checks performed sequentially. This failure is not counted as a successful build.

## Acceptance coverage

| Requirement | Evidence |
| --- | --- |
| Main menu navigation | Real Chrome navigation through missions, briefing, customization, settings and rankings preview; actual profile/rank route links; keyboard arrows/Enter and native Tab navigation. |
| Mission lobby | Configured Neon description/difficulty/objective, selected operative preview, explicit unarmed/no-reward state, readiness and successful Start Mission. |
| Settings persist | Audio values, mobile controls, reduced motion and high contrast survive reload; operative selection survives reload; unit test checks unrelated account keys remain unchanged. |
| Pause/resume/Continue | Physics and time freeze, explicit resume works, same run survives menu suspension; focus loss pauses; held input clears. |
| Restart | Cancel preserves the paused run; confirm resets position/health/objective and changes run identity; one canvas and a single dodge event after restart. |
| Movement and diagonals | Unit vector/speed checks and real keyboard displacement; diagonal telemetry stays at configured walk speed rather than receiving a boost. |
| Sprint | Real run animation state and measured controller speed above 350 units/sec, plus exact configured-speed unit tests. |
| Dodge | Buffered short presses, rejected repeats during cooldown, cooldown expiry, normalized direction, and no tunneling through actual static cover in the browser. |
| Animation | All three operative atlases change actual frame names, return to stationary fallback, face correctly, and have valid transparent frame edges. Unit tests cover transient interaction, hurt resolution, death terminal state and valid fallback keys. |
| Mouse aim | Facing stays aimed right while the player moves upward; the live reticle is rendered. |
| Mobile multitouch | Two simultaneously owned touch IDs drive move/aim; releasing aim does not stop movement; cancellation stops movement; sprint/dodge controls function; unarmed fire is disabled. |
| Camera / collision | Real wall/cover collision, world bounds, follow movement, responsive zoom and portrait-to-landscape canvas resize. |
| HUD | Real 100→75→0 health updates through the QA-only controller adapter, damage feedback, zero movement after death, and actual uplink objective 0/1→1/1. |
| Focus / accessibility | Gameplay keys are blocked in the QA text field; pause/settings and defeat dialogs manage focus; native confirmation dialogs trap focus; reduced motion/high contrast and larger touch targets are implemented. |
| Cleanup | Three repeated exit/entry cycles, changed run identity after restart, DOM router listener disposal unit tests, zero canvases after final exit, and a browser probe asserting audio sources are cleared and paused. |
| Existing app behavior | Existing backend tests pass; actual profile/rank links retained; production auth gates and services unchanged. A live external-wallet/Google sign-in or transaction was not performed. |

No weapon is equipped in this mission. Therefore real firing, projectile damage, ammo depletion, shields and extraction are not represented as completed gameplay. Their HUD/control slots are conditional and no fake values or effects are presented.

## Actual screenshots

- [Main menu, desktop](rivals-combined01/main-menu-desktop.png)
- [Mission briefing](rivals-combined01/briefing-desktop.png)
- [Settings](rivals-combined01/settings-desktop.png)
- [Pause menu](rivals-combined01/pause-menu-desktop.png)
- [Playable arena](rivals-combined01/arena-desktop.png)
- [Desktop controller / aim](rivals-combined01/controller-desktop.png)
- [Portrait touch controls](rivals-combined01/controller-mobile-portrait.png)
- [Landscape touch controls](rivals-combined01/controller-mobile-landscape.png)
- [Defeat validation, QA-only](rivals-combined01/defeat-validation.png)
- [Mobile Balanced benchmark / NYX](rivals-combined01/mobile-balanced.png)
- [Mobile Low benchmark / ROOK](rivals-combined01/mobile-low.png)

These are real application captures. The menu background is the supplied labeled concept art, cropped to the chamber. The playable scene renders independent game assets. The reference's chibi lobby character and the more realistic playable humans still differ stylistically. The original illustration is low resolution when enlarged; a matching high-resolution human lobby render remains a future art improvement.

## Measured performance

See [performance.json](rivals-combined01/performance.json). Measurements use the minified gameplay regression bundle, local preview server, Canvas renderer and real frame intervals. A later equivalent teardown-guard replacement uses the public animation API and does not alter rendering or movement. Mobile uses **4× CPU throttling, DPR 2, browser emulation**, not physical Android hardware. All scenarios use their stated graphics preset; the active arena fills the viewport.

| Scenario | Startup after Start | Sample FPS | p95 frame time | Essential image bytes | JS heap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop High / VEX / 1440×1000 | 2,771 ms | 9.21 | 220.60 ms | 767,158 | 10,185,936 bytes |
| Mobile Balanced / NYX / 390×844 | 3,857 ms | 30.78 | 57.60 ms | 790,878 | 9,495,736 bytes |
| Mobile Low / ROOK / 390×844 | 3,955 ms | 31.50 | 59.00 ms | 787,068 | 8,969,700 bytes |

**Desktop High remains below target.** Mobile sample averages are around 31 FPS, but p95 stalls do not establish stable 30–60 FPS. This is a measured limitation, not a guarantee of commercial performance on desktop or Android devices.

The prior phase recorded 9.74 / 28.16 / 31.73 FPS on the same nominal scenarios. The game now uses the full viewport instead of reserving the bottom navigation area, so canvas dimensions differ. Host scheduling/cache state and these layout differences prevent treating the samples as a controlled performance improvement percentage. The implemented allocation/subscription/paused-loop improvements are concrete; further renderer/fill-rate profiling and representative hardware tests remain necessary.

Reported visual transfer was **795,488 / 1,029,244 / 1,025,434 bytes**; whole-page resource transfer was **1,877,979 / 2,111,735 / 2,107,925 bytes**. These are Resource Timing measurements under the local server/cache conditions, not universal compressed download sizes. Mobile runs preview the default VEX before choosing NYX/ROOK, so menu-preview requests are included. The Phaser scene itself still loads only its selected operative.

The selected four base image textures have a theoretical RGBA footprint of **10,878,976 bytes**. JS heap excludes decoded native images, effect textures, canvas buffers and graphics memory. Optional audio was muted during the performance scenarios.

After desktop exit and forced GC, JS heap was **7,410,504 bytes**; after three additional entry/exit cycles it was **8,032,760 bytes**, a **622,256-byte** difference. **Zero canvases remained.** This short probe does not prove the absence of all long-run leaks. Audio release is checked separately through retained references to the actual HTMLAudio elements.

## Problems caught and corrected

- Explicit settings selector names made the browser locators/accessibility labels unambiguous.
- The reference-art crop initially exposed reference-only UI/statistics; framing now isolates the chamber. The main Play button's contrast and preview floor-ring alignment were corrected after screenshot inspection.
- The restart check was changed from canvas-node replacement to run identity/reset state because Phaser intentionally pools canvases.
- Paused game-loop resume resets delta time before waking, preventing suspended time from becoming a physics catch-up interval.
- Unused Phaser input/audio managers were disabled; the central DOM router and optional bounded audio bus own those features.
- Touch aim now takes precedence over stale mouse aim on hybrid devices.
- Scene shutdown alone does not cover every Game.destroy path. The game owner now invokes idempotent scene release before destruction, with shutdown/destroy fallbacks and a late-create guard after disposal. A real audio-source release regression passes.
- The final type check caught a protected animation-manager property used as a teardown guard. It was replaced by the public `exists` API; no private Phaser access is required.
- The supplied frontend environment existed under `src/.env`; Vite now recognizes that location without copying or exposing the file.

## Remaining limits

Physical Android/iOS, real hybrid hardware, non-Chrome browsers, sustained thermal/network tests, live external authentication and production deployment were not verified. No deployment or publishing action was performed.

Dedicated idle/run/dodge/aim/interaction/attack/hurt/death and aiming-strafe art still needs a matching authored animation pass. Existing compatible fallback poses/loops remain explicit. Final combat, weapon integration, shields, extraction, persistent mission progression, competitive rankings and cosmetics belong to their authorized future phases.

There are no unresolved critical functional failures in the exercised scenarios. Desktop frame performance, final animation/art quality and the broader device matrix remain material limits before commercial sign-off. See the [technical handoff](RIVALS_COMBINED_01.md).
