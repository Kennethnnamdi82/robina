# Combined prompt 3 — verification and evidence

Scope: original phases 7 + 8, intelligent guards and interactive heist security. This extends the prior world/combat slice; it does not implement the next combined prompt. Backend/account/database source is unchanged, and no records, balances or entitlements were migrated or deleted.

## Check results

| Check | Actual result |
| --- | --- |
| Frontend complete unit/integration suite | **91 passed, 24 files**, 30.95 seconds |
| Existing backend suite | **12 passed**, 7.23 seconds |
| Application + Node TypeScript | Passed |
| Repository ESLint | Passed, zero errors; nine existing Fast Refresh warnings in shared UI/context files |
| Production build | **Passed**, 10,283 modules, 1m43s |
| Final minified isolated game preview | **Passed**, 1,648 modules; passed on the final source |
| Complete RIVALS browser regression | **All 23 scenarios verified**: final full run 22 passed / 1 failed (5.0m); corrected heist route passed in focused rerun (1.1m) |
| Desktop/mobile benchmark and teardown | Four scenarios measured, no page errors; zero remaining canvases after four exits. CPU-stress performance remains below target. |
| Whitespace/backend scope/configuration | `git diff --check` passed; backend diff empty; existing `src/.env` remains ignored |

Logs are retained under `test-results/rivals-combined03-*.log`. No production validation gate was disabled. Browser tests load the actual GamingPage in StrictMode through an isolated entry; this avoids login/API dependencies and does not bypass production authentication.

Production retains the existing third-party PURE annotation and large-chunk warnings. The game adapter is 70.71 kB (23.12 kB gzip); the lazy Phaser engine is 1,208.02 kB (332.17 kB gzip); the existing platform/wallet vendor chunk remains 7,175.53 kB (2,059.73 kB gzip). The isolated QA build is not the authenticated production entry. Browser tracing is opt-in (`--trace on`) or first retry; ordinary regression runs avoid recording a trace for every scenario on this constrained host. Failure screenshots and explicit scenario captures remain enabled.

## Model and integration coverage

- Enemy cone/range/buildup/solid occlusion; heard combat and last-known positions; suspicion/chase/attack/search/return; paths around obstacles and doors, bounded searches, stuck recovery, ranged spacing, pursuit permission, hard pursuit limit with uninterrupted visibility, hurt/stun/death once and fresh controllers after restart.
- Network incident response beyond local hearing range, no implied visibility, per-incident consumption and outside-range rejection. Security alarms have source cooldowns, expire after quiet field time and create a fresh incident afterward.
- Actual laser segment contact, safe/warning/live timing, device hit cooldowns, camera buildup/occlusion, suppression and expiration.
- Wrong sequence, retry, success, out-of-range rejection, optional model deadline, real device/door state changes and one-time hack completion.
- Closed-window/expired timed links, retained successful WEST-to-EAST latch, both relay requirements and all four vault prerequisites. Generic interaction cannot bypass a hack or timed pad.
- Hacking freezes player intent through the session/scene boundary, pause safely cancels isolation, production-default diagnostics stay off.
- Existing movement, dodge/grace windows, health, projectile sweeps/cover/teams/pool limits, reload, map connectivity and world interactions remain covered by the full frontend suite.

The full browser matrix additionally exercises actual keyboard/pointer traversal and fights, camera alarm, laser damage, hack failure/retry/success, alarm-to-enforcer response, timed pads, both relays, real vault opening, core collection, south extraction and complete restart reset. No test grants access flags, teleports, changes HP or invokes private victory APIs. Read-only telemetry supplies observed positions/state for assertions and aiming; interactions still enter through gameplay input.

Mobile checks use Chrome touch emulation: simultaneous movement/aim/fire, cancellation, reload, pause, resize, terminal pad taps, retry, close/cancel and restored controls. This is not physical Android/iOS certification.

## Issues found and corrected

- Network alarm response originally reused short local hearing range. Separate configured alert ranges now deliver incident locations without bypassing perception/occlusion.
- HUD sampling originally notified subscribers repeatedly and rewrote unchanged attributes. Scene adapter publications are now batched and telemetry writes only changed values; a nested/exception-path unit test verifies notification behavior. Measurements are retained rather than assuming this resolves the rendering bottleneck.
- Damage cleared held input. Living operatives now recover their held movement/fire intent after the brief hurt lock; death still clears it.
- Pursuit distance originally applied only after losing sight. A return-home latch now enforces the limit during continued visibility and ignores new noise until home.
- The pursuit-limit regression caught a stale cached chase path after transitioning to return. State transitions now invalidate the old path immediately. The complete suite passed after the fix; the final 91-test run also covers atomic HUD publication.
- Automated routes now wait for zero velocity before interacting. The laser browser check requires the actual 12-point hit rather than accepting unrelated enforcer damage. The touch test releases the aim contact ID while preserving movement; the combat test stands off the line between two targets so legitimate trailing rounds do not invalidate its unrelated-target assertion.
- Input-driven route tests exposed inaccurate stopping positions at an interaction boundary and laser contact, plus attempted paths through the locked vault and solid sector console. Test routes now approach within range and navigate around those actual obstacles; collision was retained.

The earlier combined-02 report recorded 19/20 browser passes and a repeated-exit timeout before final verification was interrupted. Its historical results are preserved. This report records the current integrated game, including those prior combat/cleanup regressions; it must not be read as a retroactive claim about an unmeasured earlier build.

The first normal-graphics full run passed 21/23 scenarios in 5.1 minutes. A subsequent clean run passed all 23 before the final HUD update. The final HUD build passed 22 in the full run; the heist rerun uses the open northern firing lane around relay A cover and 100 ms polling to reliably observe the short start-window condition, and passed. The two failed expectations were corrected as described above; neither required changing gameplay rules. Final results follow below.

## Screenshots and performance

Final evidence captures the actual implemented canvas and UI; the supplied concept reference is not represented as gameplay.

- [Lobby](rivals-combined03/lobby-desktop.png), [playable arena](rivals-combined03/arena-desktop.png), [guard attack](rivals-combined03/guard-attack.png).
- [Camera alarm](rivals-combined03/camera-alarm.png), [laser damage](rivals-combined03/laser-damage.png), [hack input on mobile](rivals-combined03/hack-input-mobile.png), [hack success](rivals-combined03/hack-success.png).
- [Timed phase link](rivals-combined03/phase-link.png), [vault/core access](rivals-combined03/vault-access.png), [local extraction](rivals-combined03/extraction-desktop.png).
- [Mobile portrait](rivals-combined03/combat-mobile-portrait.png), [mobile landscape](rivals-combined03/combat-mobile-landscape.png).

[Measured data](rivals-combined03/performance.json) records the selected Canvas renderer and normal Chrome graphics settings. Numbers below are host/emulation measurements, not physical-device certification.

| Scenario | CPU | Average FPS | Sustained-fire FPS | p95 frame | Scene startup |
| --- | --- | ---: | ---: | ---: | ---: |
| Desktop high / VEX / 1440?1000 | 1? | 37.65 | 37.33 | 30.40 ms | 683 ms |
| Mobile balanced / NYX / 390?844 | 1? | 56.85 | 56.22 | 24.20 ms | 539 ms |
| Mobile balanced / NYX / 390?844 | 4? throttle | 10.82 | 10.99 | 127.30 ms | 2037 ms |
| Mobile low / ROOK / 390?844 | 4? throttle | 11.73 | 11.90 | 114.00 ms | 1536 ms |

All four cases reported no page errors. Desktop post-GC JS heap was 8,148,192 bytes after the first exit and 8,749,948 bytes after three further exits (+601,756 bytes); remaining canvases: **0**. This short check does not prove absence of every memory leak. The base/combat image and floor-cache RGBA estimate is 28,476,712 bytes (27.16 MiB), excluding effect textures, render targets, decoded copies and browser/native allocations.

**Remaining performance gap:** the desktop sample does not reach 60 FPS, and both 4? CPU mobile stress cases are below a smooth-play target. Low effects alone do not resolve that CPU-bound stress case. Physical-device profiling and further render/update optimization are required before production performance signoff. HUD batching improves publication behavior; the benchmark does not establish it as a cure for this bottleneck.

The benchmark uses a minified isolated QA build, Chrome Canvas with normal browser graphics settings, 1440×1000 desktop high/VEX and 390×844 DPR2 mobile balanced/NYX and low/ROOK with **4× CPU throttling**. The player traverses the real transit door into the guard/security area before sustained firing. Samples include AI, camera/laser simulation, projectile effects and reload. Frame stalls remain in the measurements. Desktop teardown measures post-GC JS heap after one exit and three additional exits; heap excludes browser/native/graphics allocations and is not total memory.

The earlier forced-SwiftShader regression completed 20 scenarios, failed two input-position checks and hung during one context teardown (1.3 hours total). A normal-graphics probe started in 0.77 seconds and measured 32.44 FPS at insertion; this diagnosed a test-browser graphics constraint, not a product renderer change. Forced software graphics are now optional via `RIVALS_SOFTWARE_RENDERER=1`. The final normal-graphics regression and benchmark below supersede that diagnostic run; the software run remains in `test-results/rivals-combined03-software-browser.log`.

A renderer comparison also tested Phaser WebGL using normal Chrome graphics settings. It was slower on this host (2.33 FPS desktop, 9.66 FPS normal-speed mobile), so the shipped configuration remains Canvas. Comparison data is retained in `rivals-combined03/performance-webgl-comparison.json`; the final selected-renderer measurements are in `performance.json`.

## Remaining limits

This is a local single-player training slice with actual guards and security, not server-authoritative competitive gameplay. Optional timed hacking is model support; the shipped terminal deliberately freezes field simulation and has no timer. Dedicated enemy uniforms and authored combat/hurt/death cycles, refined environment composition/lighting and art matching the final reference remain visual work. The current panel opening and death collapse use procedural presentation of supplied art.

Physical devices, Safari/Firefox, authenticated production sessions, long soak tests and deployment are not claimed. See [architecture, controls, local commands and next-phase handoff](RIVALS_COMBINED_03.md).
