# RIVALS: RIVAL HEIST — Phase 0 handoff

Scope: `/gaming`, the Arena lobby and a single-player movement/collision training vault. No combat, enemies, puzzles, missions, progression, inventory UI, NFT features, purchases or multiplayer have been implemented. All art references to those future systems are design direction only.

## Run locally

Use Node 24 and run from `robina/robina`:

```powershell
npm ci
npm run dev:rivals
```

Open **http://127.0.0.1:8082/tests/rivals/index.html**. This development-only harness renders the real GamingPage, in React StrictMode, with the site's bottom navigation. It needs no backend, wallet, database or login and is not included in the production entry.

For the integrated app, configure the existing environment as described in `.env.example`, run `npm run dev`, sign in normally, then open `/gaming`. Existing authentication remains in place. The unrelated season snapshot banner is hidden specifically on `/gaming`; other pages retain it.

Click **Enter the Arena**. Move with **WASD / arrows** or the **touch joystick**. Walls and cover physically block the operative. **Escape** or the pause button pauses gameplay. Resume explicitly or return to the lobby from the pause panel. Tab/window focus loss pauses automatically. Ambient audio is off by default and can be enabled in the arena toolbar. The sealed vault and machinery are environmental scenery in Phase 0.

The public runtime assets are already prepared. To reproduce the exports while the original supplied pack is present:

```powershell
npm run prepare:rivals
```

The exporter copies exact source files without modifying the originals. `public/assets/rivals/v4/manifest.json` records every source path, byte count and SHA-256 hash.

## Architecture

```text
src/pages/GamingPage.tsx                /gaming shell; lobby ↔ arena lifecycle
src/features/rivals/
  assets.ts                            versioned URLs, sprite metadata, prop keys
  core/contracts.ts                    typed scene, character and future domain contracts
  core/session.ts                      instance-local React ↔ Phaser bridge
  game/createGame.ts                   lazy engine boot, resize observer, teardown
  game/ArenaScene.ts                   Phaser scene, loader, Arcade physics, camera, audio
  systems/movement.ts                  normalized input, deadzone, four-way animation facing
  world/trainingVault.ts               arena layout, independent collisions, prop definitions
  ui/Lobby.tsx                         React lobby and native-dialog field guide
  ui/ArenaView.tsx                     HUD, loading/error/pause UI, focus safety
  ui/TouchStick.tsx                    captured pointer input and cancellation handling
  ui/MiniMap.tsx                       live position over the actual collision map
  rivals.css                           scoped visuals and responsive layouts
scripts/prepare-rivals-assets.mjs       reproducible curated asset export
public/assets/rivals/v4/                14 exports; approximately 1.13 MiB total
tests/rivals/                          isolated browser harness and gameplay tests
vite.rivals.config.ts                   separate development entry on port 8082
playwright.rivals.config.ts             real Chrome desktop/touch tests
```

Phaser **3.90.0** is pinned to match the supplied Phaser demo. The existing React, TypeScript, Tailwind, Vite, Vitest and Playwright stack is retained. The game engine is dynamically imported on arena entry and assigned its own `rivals-engine` build chunk; it is not a module preload of the website. No engine instance runs in the lobby.

Canvas rendering is intentional for this phase: orthogonal tiles, animated sprites, cached colored light textures and additive blending need no WebGL shaders. This avoids software WebGL startup costs and retains browser compatibility. The canvas uses CSS-pixel resolution to bound fill cost on high-density mobile screens. Tiles are culled by Phaser's tilemap layer. Physics uses a fixed 60 Hz step; the HUD publishes at approximately 10 Hz. This is a configuration target, not a certified device frame-rate claim.

The sprite's circular collision body sits at the operative's feet. Tile collisions and prop bodies are independent of artwork. Keyboard/touch inputs share a normalized vector, so diagonal movement cannot exceed cardinal speed. Audio, physics and animations pause together. Exiting disconnects the resize observer, destroys the Phaser game and audio, removes the host canvas, clears scene subscriptions and removes window/document listeners.

## Asset audit and visual limitations

The supplied `src/features/rugfire/RIVALS/RIVALS_ALL_IN_ONE_V4` contains a V4 standalone Canvas prototype, a Phaser/TypeScript V3 demo, duplicate V3 asset libraries, screenshot references, Kenney packs, audio, orthogonal maps, terrain atlases and transparent character/enemy/effect animation sheets. The standalone prototypes are audited references, not imported application entry points; they are excluded from application TypeScript/lint processing.

Reused now: V4 VEX idle/walk sheets (96 × 96 frames, four directional rows), the 64 × 64 Neon atlas, eight props, ambient audio, and the supplied lobby chamber illustration. The source training map only encloses an empty room; the new 28 × 22 arena adds connected passages and collidable cover. Existing RUGFIRE uses Three.js and a third-person 3D world, so its engine and 3D models are retained as source material without mixing projections or loading them into this 2D scene.

The chamber is a CSS-framed crop of the supplied flattened concept panel and is explicitly labelled chamber art. The lobby's text, buttons and field guide are real React UI. The arena is rendered from independent terrain, props and sprites; it never uses a gameplay screenshot as its world.

The playable art is visibly simpler than the cinematic target. The current pack does **not** provide a matching separated high-detail chamber/background, cinematic full-body character source, fully articulated eight-direction operative animations, richly connected raised-wall tiles, or editable layered source art. A faithful final visual match requires improving those exports in a later art phase. Current four-way sprite poses are similar in silhouette. The lobby illustration's operative and the runtime VEX sprite are different levels of art fidelity. No claim of pixel-identical or finished commercial art is made.

## Data and backend boundaries

No database migrations, account rewrites, new balance fields, payouts or backend endpoints are needed for Phase 0. Existing Express/MongoDB auth, balances, entitlements and records are preserved. The RIVALS module imports no mining/payment API and writes no game results to storage. Legacy application pages remain available; mining has no controls or balances inside the new game UI. The training scene is ephemeral and resets on exit.

`SceneSystem` provides an update/dispose contract for later scene systems. Character definitions and arena data are separate from rendering. Reserved combat, mission, item, appearance and ranking types establish domain boundaries without presenting unfinished systems as usable features. Socket.IO is deferred until a phase actually requires real-time network interaction.

## Verification commands

```powershell
npm run typecheck
npm test
npm run test:e2e:rivals
npm run build:dev
node node_modules/eslint/bin/eslint.js src/features/rivals src/pages/GamingPage.tsx tests/rivals vite.rivals.config.ts playwright.rivals.config.ts
```

The production `npm run build` additionally requires the existing real `VITE_API_URL`, `VITE_PRIVY_APP_ID` and `VITE_REOWN_PROJECT_ID` settings. Those should not be invented for a test build. Chrome defaults to the existing Windows installation; set `PLAYWRIGHT_CHROME_PATH` for another installation.

The old `test:e2e` command still targets the archived RUGFIRE operation. Use `test:e2e:rivals` for the new gaming page. The legacy production wallet/backend signoff suite requires its separate production environment and is not a Phase 0 game test.

Validation results and screenshots are recorded in `RIVALS_PHASE_0_QA.md` after checks complete.

## Next-phase technical handoff

1. Confirm the desired art fidelity against the captured lobby and live arena screenshots; commission/export missing separated art before promising an exact concept match.
2. Keep the verified movement/collision/pause/lifecycle tests as regression gates. Test real Android/iOS hardware and Safari before making mobile performance guarantees.
3. Implement the next explicitly requested phase as scene systems with update/dispose lifecycles. Keep enemy/combat rules independent of React and put arena/mission configuration in data modules.
4. Decide the server-authoritative game-session and reward contract before adding persistent progression or competitive rankings. Client telemetry is diagnostic, not evidence for currency grants.
5. Add inventory/customization or real-time networking only when requested. Preserve historical entitlements through explicit adapters; never reinterpret legacy balances as unverified game rewards.

Reference: [Phaser Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade), [Phaser 3 releases](https://editor.phaser.io/download/phaser3).
