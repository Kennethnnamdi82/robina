# RIVALS Phase 0 — verification record

Date: **29 October 2026** (Africa/Lagos).

The local foundation acceptance checks passed. These results verify the actual GamingPage and Phaser scene, not the supplied reference screenshots or standalone prototypes. Production authentication/deployment was not signed off in this environment.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: application and build/test configuration TypeScript projects. |
| `npm test` | Passed: **36 tests across 11 files**, including 9 new RIVALS movement, lifecycle and map-connectivity tests. |
| Focused ESLint | Passed for RIVALS source, GamingPage, browser tests and new Vite/Playwright configs. |
| `npm run test:e2e:rivals` | Passed: **6 real Chrome browser tests**, final run approximately **4.8 minutes**. |
| `npm run build:dev -- --logLevel error` | Passed after the final camera, rendering, lobby and route changes. |
| Runtime asset integrity | Passed: all **14 SHA-256 hashes** match the curated export manifest. |
| Engine loading | Confirmed: lobby does not request Phaser; final built HTML does not preload the separate 1,208,021-byte raw `rivals-engine` chunk. |
| `git diff --check` | Passed. |
| `npm run build -- --logLevel error` | Existing production configuration gate stops at missing **`VITE_API_URL`**. Real API/Privy/Reown environment settings are required before production signoff. |

## Browser coverage

1. Lobby renders real React controls, opens/closes the field guide, avoids horizontal overflow, and loads no game engine before entry.
2. Actual keyboard input moves the Phaser operative into a crate and a boundary wall. Assertions check real player coordinates and collision counts. Moving through the arena verifies camera tracking.
3. Pause freezes physics, player coordinates and the timer. Resume restores movement. Three repeated exit/re-entry cycles leave no old canvas and create exactly one new canvas.
4. Window blur pauses automatically. Escape resumes. Ambient-audio controls change state through actual UI interaction.
5. Intentionally aborting the terrain texture produces a visible load-error panel. Returning to the lobby and retrying with the asset available launches a working scene.
6. A **390 × 844** mobile browser context uses Chrome's real touch-event dispatch to drag the joystick. Touch cancellation stops movement; touch pause/resume works; resizing to **844 × 390** updates the canvas and retains usable controls.

Desktop screenshots use a **1440 × 1000** viewport. Mobile screenshots use device scale factor 2. Tests run the real page in React StrictMode through the isolated development entry, with the actual bottom navigation. Gameplay assertions observe rendered session state and send keyboard/touch input; they do not teleport the player, bypass collisions, fake success, or submit fabricated rewards.

Earlier iterations exposed cold-start/renderer costs and test timing assumptions. The final scene uses Canvas with cached colored lights; navigation assertions wait for actual movement rather than assuming a fixed automation frame rate. An asset-recovery assertion now allows the asynchronous loader to report its failed request. The final run has no failing browser tests.

## Captured implementation

- [Desktop lobby](rivals-phase0/lobby-desktop.png)
- [Desktop playable arena](rivals-phase0/arena-desktop.png)
- [Mobile lobby](rivals-phase0/lobby-mobile.png)
- [Mobile playable arena](rivals-phase0/arena-mobile.png)

These are browser captures of the implemented application. The lobby chamber is explicitly decorative supplied concept artwork; the playable scene uses independent animated sprites, terrain tiles, props, physics and a live camera.

## Remaining limits and next gate

- The supplied runtime art remains simpler than the cinematic reference. Separated high-detail environment/operative assets and richer directional animation exports are needed for a closer final visual match.
- Mobile Chrome emulation passed; real Android/iOS device performance and Safari compatibility still need hardware testing. A stable 60 FPS performance target has **not** been certified.
- The full website's production build/authentication requires real existing environment settings. No fake credentials, database migrations or account mutations were used to manufacture a successful production check.
- No unresolved failure was observed in the tested Phase 0 movement/collision/pause/exit flows. Combat, missions, inventory, ranking and multiplayer remain deliberately outside this phase.

See [the architecture and next-phase handoff](RIVALS_PHASE_0.md).
