# RIVALS Prompt 02 — verification

Historical phase report: the later [combined prompt 1 handoff](RIVALS_COMBINED_01.md) resolves the frontend environment location and records newer build, controller and performance results.

Tests were run on the available Windows host using local Chrome 155.0.8059.85. Desktop and mobile layouts use the same GamingPage, Phaser scene, artwork and controls as the integrated `/gaming` route. The isolated QA entry omits authentication/backend setup. It does not establish end-to-end production authentication or physical Android compatibility.

## Functional verification

| Check | Result |
| --- | --- |
| Frontend unit suite | **44 passed, 15 files** (`npm test`, 36.49 seconds with two workers). Includes actual file hashes/byte counts, every exported atlas frame's bounds, character fallback plans, movement/session behavior, quality selection and active-frame timing. |
| Minified standalone game build | **Passed** (`npm run build:rivals:preview`, final input-fix build 39.41 seconds). |
| Browser suite against minified build | Initial main run: **9 passed, 1 failed** (8.1 minutes). The remaining interaction check was corrected and the real quick-keypress issue fixed. Final focused regression: **2 passed** (1.0 minute), covering inspection and repeated pause/exit lifecycle. Thus all **10 distinct scenarios** have passed across the main and focused runs; this is not represented as one clean ten-test invocation. |
| Full TypeScript checks | **Passed** (`npm run typecheck`, both application and Node configs), after the input fix. |
| Focused ESLint | **Passed**, no output: `src/features/rivals`, `src/pages/GamingPage.tsx`, `tests/rivals`, and the RIVALS Playwright/Vite plus Vitest configs. This is not a claim that the unrelated whole-repository lint suite is clean. |
| Complete frontend development build | **Passed** (`npm run build:dev`, 10,247 transformed modules, 2 minutes 6 seconds), after the input fix. Existing wallet annotation and large-chunk warnings remain. |
| Production build | **Blocked by existing configuration gate**: `Production configuration is missing VITE_API_URL`. The gate also requires real `VITE_PRIVY_APP_ID` and `VITE_REOWN_PROJECT_ID`. No fabricated values or gate bypass were used. |

The ten browser scenarios verify:

1. Usable lobby/field guide, no eager Phaser import, desktop overflow check.
2. Actual keyboard displacement, static cover collision, boundary collision, collision telemetry and camera tracking.
3. Paused physics/timer, explicit resume, repeated enter/leave and canvas cleanup.
4. Safe focus-loss pause and explicit optional ambient-audio control.
5. Aborted required image request produces a recoverable error; retry creates a playable scene.
6. Mobile touch-stick displacement, touch cancellation, pause/resume and portrait-to-landscape canvas resize.
7. All three separate operative atlases, actual changing walk-frame names, facing/idle transitions, alpha samples from every character frame, and selected-character loading.
8. High/Balanced/Low changes preserve the same live canvas/game, paused position, and reduced-motion preference.
9. Proximity highlight, keyboard E interaction and right-side button interaction toggle real local uplink state.
10. Corrupt atlas JSON fails visibly with a missing-frame error and recovers on retry.

## Issues found and addressed

- The first asset-integrity unit test used a Node-only environment incompatible with the application's global DOM setup. It now uses the configured test environment while reading the actual exported files.
- Running the complete frontend typecheck, default many-worker unit suite, and browser tests together exhausted the available host and caused misleading timeouts. Vitest now uses two workers and heavyweight validation runs sequentially. The failed overloaded run is not counted as a pass.
- Destroyed sprite teardown could access a detached scene. The animator now retains the animation manager and guards the sprite stop operation. Repeated-exit regression passes.
- Required asset failure assertions initially expired before the development engine had loaded. They now allow the actual cold-load interval and also run against a representative minified build.
- The interaction automation could walk through the proximity zone while a delayed key-release command traveled back from the test driver. Movement now stops through the same DOM keyboard-event path inside the page at an observed destination; no actor position or gameplay state is injected. The equipment locator is exact so it does not also match the Inspect button's label.
- A real short E key press could be lost when Phaser received keydown and keyup before the next slow frame. `ArenaScene` now buffers the key-down edge and consumes it in the following update, clearing pending input on pause. The test uses a quick press and verifies the actual state change.
- Quality changes while paused could leave dust stopped after resuming. Resume reapplies the current effect settings. Reduced motion and low quality disable their intended effects.

## Measured performance

The machine-readable [performance report](rivals-phase02/performance.json) comes from the minified isolated QA build, local preview server, Canvas renderer, Chrome, and real `performance.now()` frame intervals. Frames are sampled in a bounded 240-entry ring; active stalls are retained. Explicit pause durations are excluded. Mobile emulation uses 390×844 CSS pixels, DPR 2 and **4× CPU throttling**. Desktop is 1440×1000 CSS pixels, with a 1440×928 game canvas above the existing navigation.

These are short local samples, not a device matrix, sustained thermal test, network benchmark, or a guarantee. Mobile emulation is not a physical Android phone. Browser/OS scheduling and software graphics affect results. The later inspection-edge fix does not change the measured renderer/art; startup and frame results below were captured before that small input fix.

| Scenario | Startup after Enter | Sample FPS | p95 frame | Essential image bytes | JS heap used |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop High / VEX | 2,881 ms | 9.74 | 173.10 ms | 767,158 | 13,017,124 bytes |
| Mobile Balanced / NYX / 4× CPU | 4,923 ms | 28.16 | 72.50 ms | 790,878 | 9,021,920 bytes |
| Mobile Low / ROOK / 4× CPU | 3,451 ms | 31.73 | 57.60 ms | 787,068 | 9,086,880 bytes |

**Desktop High is below target.** Balanced mobile is also below 30 FPS in this sample, and Low does not establish consistent 30 FPS because p95 stalls remain. No 60-FPS desktop or 30–60-FPS physical-phone claim is made. Profile frame composition, Canvas blending/scaling and browser hardware acceleration on representative devices before production performance sign-off. Preserve the selectable lighter presets in the meantime.

All three scenarios reported zero uncaught page errors. Actual compressed visual transfer, including three lobby portraits, required atlas metadata and HTTP/cache overhead, was 795,188 / 818,908 / 815,098 bytes respectively. Whole-page resource transfer was 1,230,869 / 1,888,844 / 1,885,034 bytes in these local sessions; it includes application/engine resources as delivered by this preview server and is not a universal network payload.

The four selected image textures have a 10,878,976-byte theoretical RGBA footprint. JS heap excludes decoded native image memory, effect textures, canvas buffers and graphics memory. The all-operative runtime export set is about 1.21 MiB, but unselected large character atlases are not requested during play.

The desktop teardown probe forced GC after exit: first post-exit JS heap 8,209,964 bytes; after three additional entry/exit cycles 8,495,516 bytes, a 285,552-byte difference; **zero canvases remained**. This short check detects major lifecycle regressions, not proof that every possible memory leak is absent.

Development smoke loading was much slower (~35 seconds after Enter) because it includes development dependency import/parsing; the smoke capture's FPS value was taken before the first metrics sample and is not used as a performance result. Use the minified build for repeatable comparative measurements.

## Screenshots and browser messages

Actual captures are saved in [rivals-phase02](rivals-phase02/), including desktop/mobile lobby, desktop/mobile arena, each operative, quality settings and benchmark scenarios. See the [visual review](RIVALS_PROMPT_02_VISUAL_REVIEW.md) for target comparison and remaining art needs.

Expected `net::ERR_FAILED` console messages occur in the deliberate aborted-image recovery test. Playwright/Node also prints a `NO_COLOR`/`FORCE_COLOR` environment warning. Development headless runs can print unavailable audio-device/WebAudio warnings; ambient audio is optional/off by default, and the minified functional run did not report uncaught page errors. The minified QA build warns about the Phaser-containing chunk exceeding 500 kB; the engine remains deferred until entry. Existing wallet dependency build annotations/chunk warnings are recorded with the full-application build, not described as game runtime failures.

## Limits and release status

The playable visual foundation is implemented and its functional scenarios have been exercised. **Production deployment is not verified** while its real configuration is missing. Final cinematic equivalence, authored action cycles, sustained desktop performance, physical Android QA, final art seams/perspective cleanup, and a full device/browser matrix remain outstanding. See the [handoff](RIVALS_PROMPT_02.md) for scope and Prompt 03 integration points. No next-phase combat, payments, multiplayer, mining, database migration or entitlement changes were implemented.
