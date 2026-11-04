# RIVALS 3D migration — validation and limitations

Client date: 2026-10-31. Development branch: `feature/rivals-3d-migration`. Baseline: `368e949`. This is a development foundation; Phaser retirement is not approved or implemented.

## Checks

| Check | Actual result |
| --- | --- |
| Frontend unit regression | **119 passed**, 27 files, 50.21 s |
| Application and Node TypeScript | **Passed** |
| ESLint | **0 errors**, 9 existing shared UI/context Fast Refresh warnings |
| Explicit development flag absent | **HTTP 404**, integration checked |
| Sandbox deployment build | **Rejected as intended**, integration checked |
| 3D browser regression | **3 passed**, 3.9 min; includes original Phaser launch |
| Normal production build | **Passed**, 2 min 40 s |
| Existing backend regression | **12 passed**, 8.75 s |
| Production exclusion audit | **0 sandbox matches**, no sandbox HTML in `dist` |
| Protected source / branch | Phaser/app/auth/backend/PWA source unchanged; still on the feature branch; `main` still `368e949` |

New deterministic coverage checks legacy footprint/ID conversion, valid geometry, high-speed wall collision, gravity/jump/platform landing, 3D obstruction, camera state invariants, camera collision, grounded side-depth constraints, independent zoom, sandbox persistence isolation, swept projectile impacts/cover and the 48-shot pool bound. Existing combat/health/mission/boss/security/AI tests remain in the same suite.

## Browser scenarios

The three integrated cases exercise:

1. Supplied GLB loading, tactical start, real movement and uplink interaction; tactical → TPS → FPS → side → TPS switching without state replacement; bounded zoom; actual jump/landing and switching in flight; real firing/reload; pause/frozen mission time; departure to the original Phaser page and a working original Phaser launch.
2. Traversal to a converted door, blocked movement while closed, actual door interaction, entry into the concourse, aiming at the rendered guard and damage through the shared enemy FSM. The test uses projected read-only diagnostic coordinates and ordinary input; it does not edit health or grant objective flags.
3. Touch-capable portrait/landscape emulation, POV/quick switch, zoom, quality selection, controls after resize, two fresh scene restarts with one canvas and tactical defaults, then exit with zero canvases.

Earlier passes exposed a development stair footprint obstructing the legacy route and delayed loading of the fallback through a cold Vite dependency cache. The stair metadata was moved west of that route, and the existing fallback entry is included in dependency preparation. A later slow-host test overshot the uplink through delayed keyboard release; release now happens in the browser at the telemetry threshold. No source Phaser gameplay was changed to make these checks pass.

The full prior Phaser phase had 23/26 browser cases pass before this migration, with a stale optional-uplink assertion and two automation firing/positioning failures. Those unresolved historical results are not replaced with a claim that the whole old heist was verified. This migration's fallback case checks the unchanged game can launch; it does not claim a new full Phaser boss-victory run.

## Performance

`node scripts/benchmark-rivals3d.mjs` measured the following low-quality scenarios across the four views with sustained firing. This is the development entry at spawn, not a complete active-boss encounter. Values come from actual WebGL renderer/HUD counters. Each reported FPS is a rolling-window sample, not a long-run average.

| Scenario | CPU throttle | Tactical FPS | Side FPS | TPS FPS | FPS-view FPS |
| --- | --- | --- | --- | --- | --- |
| Desktop 1440×900 | 1× | 4.0 | 4.6 | 5.0 | 5.7 |
| Mobile emulation 390×844, DPR 2 | 1× | 11.1 | 14.5 | 14.3 | 16.3 |
| Same mobile viewport | 4× | 6.6 | 7.9 | 9.2 | 11.3 |

The actual driver in all scenarios was **ANGLE / Vulkan SwiftShader (software rendering)**. These values are below the target, and they cannot establish performance on an Android phone's hardware GPU. Adaptive rendering reduced DPR to 0.7 where slow frames persisted. Recorded draw calls were approximately 13–44 and triangles about 4.5k–20k, depending on view. This evidence does not justify replacing the working Phaser implementation.

All three benchmark scenarios reported **zero page errors** and **zero canvases after exit**. Post-exit JavaScript heap samples were 11.55 / 11.65 / 11.58 MiB. JS heap excludes native/GPU allocations; zero canvases and these short samples are cleanup checks, not proof against every leak. Full data, driver strings, viewport/quality details and methodology are in [performance.json](rivals-3d/performance.json).

The normal production build passed its existing public-configuration checks. It retains pre-existing wallet/vendor large-chunk and third-party PURE-annotation warnings. A subsequent bundle audit found no experimental sandbox strings/styles or sandbox HTML. No production deployment occurred.

## Screenshots

Fifteen screenshots were captured from the implemented runtime and tests. They show the current compatibility art, including its remaining blockout elements; they are not final target artwork.

- [Tactical](rivals-3d/desktop-low-tactical.png), [side view](rivals-3d/desktop-low-side.png), [third person](rivals-3d/desktop-low-third.png), [first person](rivals-3d/desktop-low-first.png).
- [Actual guard combat](rivals-3d/guard-combat.png).
- [Mobile portrait](rivals-3d/mobile-portrait.png), [mobile landscape](rivals-3d/mobile-landscape.png).

Physical Android/iOS performance, ten-minute thermal behavior, Safari/Firefox and device-specific GPU context recovery remain unverified. The target is 30 FPS on representative budget phones and up to 60 FPS on capable hardware; no claim that these targets have been met is made.

## Remaining replacement gates

- No full integrated **3D Guardian → vault → core → extraction → replay** playthrough has passed yet. The shared models and event adapters are connected, and unit-tested rules remain reused, but that entire 3D loop is not certified by these three browser tests.
- All four views are available in the converted ground-floor world. Side depth lanes/jumping are implemented. Exhaustive corner/stair/falling/door-transition and per-POV aiming validation throughout the full raid still needs work; arbitrary user vaults and multilevel NPC pathfinding are not claimed.
- Supplied compatibility human/security/boss models are used. Final RIVALS character likenesses, authored architectural art, richer lighting, final attack/death animation direction and visual parity remain incomplete.
- The original ground-floor AI retains conservative planar navigation/perception; 3D projectiles and camera occlusion use actual 3D solids. A future multilevel raid requires explicit 3D navigation/perception design.
- The sandbox has no production authentication, fake backend session, payments, progression writes or economic rewards. The real authentication, backend/PWA/database/monetization code and Phaser runtime remain unchanged.
- Source and docs remain uncommitted for review on the existing feature branch. Nothing has been pushed or deployed.

See [architecture, camera/control details, local phone instructions and handoff](RIVALS_3D_MIGRATION.md).

## Local phone access correction (2026-10-31)

The dedicated development server previously served the authenticated website at its root and listened only on loopback, despite the deep sandbox entry having no authentication. `npm.cmd run dev:rivals3d` now explicitly enables the isolated sandbox and listens on the LAN. Its root, index, gaming and login entry URLs redirect to the sandbox before the website/authentication providers load. The normal Vite/production configuration and authentication code remain unchanged.

- Targeted browser checks: **2 passed (38.0 s)**. Fresh unauthenticated sessions open the local entry routes; mobile emulation starts a real raid, shows movement/fire controls, pauses and exits with zero remaining canvases. Neither check requested Privy, WalletConnect, Google accounts, the website's `src/main.tsx`, or backend API routes. Both reported zero page errors.
- Application and Node TypeScript: **passed**. ESLint for the changed configuration, launcher, gate script and browser checks: **passed**.
- Development gate integration: **passed**. Missing explicit flag returns 404 for root, gaming, login and deep sandbox entry; sandbox deployment builds are still rejected.
- One-command launcher: **started successfully** on a temporary test port, printed its Network URL, and returned HTTP 200 for the sandbox via the laptop's private IPv4 address. The existing server on port 8084 also returned the sandbox through its LAN root/gaming URLs.
- No physical phone was available to automate. Windows firewall/network isolation and actual-device performance still require checking from the user's phone. No firewall settings, production authentication, deployments or databases were changed.

## HTTP LAN blank-screen correction (2026-10-31)

The reported blank screen was reproduced in Chrome at `http://10.147.47.72:8084/`. HTML returned 200, but session construction crashed with `crypto.randomUUID is not a function`. Chrome's HTTP LAN origin is not a secure context, whereas the earlier loopback browser tests were. Receiving HTML over LAN did not establish that the app rendered, and the earlier localhost mobile tests missed this difference.

The shared session keeps native UUID generation when available and now falls back to UUID v4 bytes from `crypto.getRandomValues`, which is available over LAN HTTP. No global crypto polyfill or authentication change was introduced. The sandbox HTML also shows a startup message, and import failures display their error instead of leaving an empty root.

- Targeted local-access browser suite: **3 passed (1.4 min)**. The new LAN-origin case verifies desktop and mobile Chrome contexts are non-secure and lack `crypto.randomUUID`, then renders the lobby, starts the real raid, restarts and exits. Both report zero page errors and zero auth/API requests. Lobby and raid screenshots were captured in the Playwright output directory.
- Session and 3D regression: **14 passed**, 2 files, 12.56 s. Includes mission creation with the native UUID method absent, valid unique UUID v4 IDs, existing lifecycle behavior and 3D rules/persistence isolation.
- Application/Node TypeScript, targeted ESLint and Git whitespace checks: **passed**.
- Terminal investigation found an empty untracked `npm.cmd` in the frontend root. Command Prompt resolves this before installed npm, explaining a command that produces no output. It was preserved as `npm.cmd.empty-backup`; `where npm.cmd` now resolves the installed Node executable. The dedicated launcher also disables screen clearing.

These are desktop browser checks, including mobile emulation over the actual private HTTP origin. They do not claim physical-device performance measurements or completion of the remaining migration gates above.

## Character polish follow-up

The first approved character-polish phase has **128 passing frontend unit tests**, a clean **8-case browser regression**, and final focused animation/touch checks. TypeScript, lint, normal build and development gates passed. See the [character-phase report](RIVALS_3D_CHARACTER_POLISH.md) for exact run results, supplied/derived clip coverage, screenshots, limitations and the Prompt 2 handoff. These results do not certify physical-phone FPS or the previously outstanding full Guardian/extraction/replay loop.
