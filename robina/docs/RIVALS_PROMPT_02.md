# RIVALS — Prompt 02 handoff

This phase upgrades the **playable** Neon District, asset pipeline, operative presentation, and rendering. It builds on the existing movement/collision arena. The integrated route remains `/gaming`; the isolated QA entry renders the same `GamingPage` without requiring authentication. No backend, database, historical balance, entitlement, or mining record is changed.

## Run

From `robina/robina`, with the existing Node/npm dependencies installed:

```powershell
npm run dev:rivals
```

Open `http://127.0.0.1:8082/tests/rivals/index.html`. Select VEX, NYX, or ROOK and a graphics preset, then enter the arena. Use WASD/arrows or the left touch stick. Approach the insertion hologram or a console and press **E** / tap the right **Inspect** control. The insertion uplink toggles its local state and light. It grants no rewards. Pause with Escape or the top-right button; graphics can be changed while paused. Resume explicitly or return to the lobby. Focus loss pauses automatically.

For the authenticated application, use the existing `.env.example`, `npm run dev`, sign in, and open `/gaming`. The QA entry does not replace the production authentication entry.

To test a minified standalone gameplay build:

```powershell
npm run build:rivals:preview
node node_modules/vite/bin/vite.js preview --config vite.rivals.config.ts --outDir test-results/rivals-preview --host 127.0.0.1 --port 8083 --strictPort
```

In another terminal:

```powershell
$env:RIVALS_TEST_URL = 'http://127.0.0.1:8083'
npm run test:e2e:rivals
npm run benchmark:rivals
```

Without `RIVALS_TEST_URL`, the browser suite starts/reuses the development server on port 8082. Chrome can be selected with `PLAYWRIGHT_CHROME_PATH`. The minified QA build is useful for performance measurement because development dependency parsing is much slower. It is not a production deployment artifact.

## Asset inspection and art direction

The V4 playable asset directory contains 359 files (11,287,424 bytes), including 57 duplicate-content files. The original 96px character sheets provide four directions and idle/walk/attack/dash/hurt/down sequences. Their simplified robot/chibi appearance does not supply the detailed human style requested for this phase. Existing Rugfire GLBs were also rendered for inspection: the operator is a cowboy and other candidates are simple mannequins. They were not substituted for futuristic human operatives.

The supplied `02_V4_VISUAL_TARGETS/visual_showroom` images define the direction. They are flattened illustrations, not collision-ready levels or animation atlases. They remain reference/lobby material. Original supplied files and the earlier curated V4 exports are preserved.

New coherent raster atlases were authored with the built-in image generation tool, then normalized, inspected, and exported through a deterministic Canvas pipeline. See [art sources and generation specifications](../art/rivals/phase02/README.md). The game renders individual assets; no concept illustration is used as the playable world.

Evidence:

- [Source audit](rivals-phase02/source-asset-audit.json): paths, dimensions, hashes, and duplicate groups.
- [Model inspection](rivals-phase02/rugfire-model-audit.png): rendered Rugfire candidates.
- [Frame validation](rivals-phase02/atlas-validation.json): source bounds, transparency ratios, and exported pivots.
- [Visual comparison](RIVALS_PROMPT_02_VISUAL_REVIEW.md).
- [Verification and measurements](RIVALS_PROMPT_02_QA.md).

## Organization and loading

```text
art/rivals/phase02/                Editable original PNG art and generation specifications
public/assets/rivals/v4/           Preserved curated supplied pack / ambient audio / references
public/assets/rivals/phase02/      Compressed runtime WebP textures, atlas JSON, manifest
src/features/rivals/
  core/                           Session, typed contracts, presentation preferences
  data/visualManifest.ts           Generated stable IDs, dimensions, hashes, byte counts
  characters/                     Operative definitions, animation plans, animator
  rendering/                      Validated loading, cinematic effects, frame measurement
  world/                          Tile/collision layout, separate props, environment layer
  game/                           Phaser scene and game lifecycle
  ui/                             Lobby, roster, controls, pause/settings, minimap
scripts/                          Audit, deterministic export, model probe, QA build, benchmark
tests/rivals/                     Same-component isolated QA entry and browser tests
docs/rivals-phase02/               Audit artifacts, actual screenshots, performance report
```

The generated manifest has revisioned URLs and SHA-256 hashes. Startup loads the floor, shared wall/prop atlases, and **only the selected character's** atlas. Other operatives are not preloaded; the lobby uses small portraits. Ambient audio loads only after the player enables it. Phaser and its scene code are dynamically imported after entry, not on the lobby.

All runtime visual exports together are approximately 1.21 MiB. VEX's essential image payload is 767,158 bytes before atlas metadata, portraits, or HTTP overhead. The four selected base textures have an estimated 10,878,976-byte RGBA footprint; this excludes effect textures, canvas buffers, native memory, and JS objects. Actual transfer and JS heap measurements are reported separately in QA.

`npm run prepare:rivals:visuals` reproduces the WebP exports, atlas JSON, generated manifest, and frame report from the checked-in art sources. It requires local Chrome but no generation API. `npm run audit:rivals` repeats the supplied-pack audit. Source generation itself is nondeterministic; the checked-in PNGs are the reproducible exporter inputs.

## Characters and animation

VEX, NYX, and ROOK each have 24 independently rendered frames: six walking poses in each of down/left/right/up. Exported cells are 192×192; the atlas is 1152×768. Frames share a foot pivot at `(96,174)` and a common body scale. Transparent padding, alpha bounds, and Phaser frame coordinates are validated. Linear filtering, compressed alpha-preserving WebP, and resolution-aware camera scaling preserve readable art at supported layouts.

`CharacterAnimator` owns animation state and changes animations only on state/facing transitions. The physical actor uses a separate, invisible, fixed 14-world-pixel circle at the feet. Idle breathing never changes collision geometry. Sprite depth follows foot Y; walls and props use their own foot depth.

| State | Current visual implementation |
| --- | --- |
| Walk | Authored six-frame directional loop for all three operatives |
| Idle | Explicit stationary walking-pose fallback, with subtle breathing unless reduced motion is enabled |
| Run / dash | Registered accelerated walking-loop fallback; no new run/dash gameplay |
| Attack / hurt / defeat | Registered stationary-pose fallback; no combat behavior or claim of authored action animation |

The original V4 action sheets remain available in the source pack. Mixing their incompatible proportions with the new human art would create conspicuous character changes, so they are not used as final action art. Dedicated matching action/idle cycles remain an art requirement for later phases.

## Neon District and effects

The existing logical 28×22 collision layout and spawn are retained. The floor is a tilemap, walls are depth-sorted artwork, collision is an independent invisible tile layer, and solid machinery has separate static bodies. Cover and walls physically block movement. Props include consoles, cameras, crates, pipes, pylons, a reactor, a sealed vault, and an insertion hologram. The player can inspect equipment and toggle local uplinks. The vault and reactor are inspection scenery, not completed missions or puzzles.

`CinematicEffects` supplies cached radial light textures, additive light pools, operative ground ring, soft contact shadows, subtle light-relative shadow movement, bounded dust, animated scanner cones, and interaction emphasis. These are Canvas-compatible approximations; there is no real-time shadow casting, normal-map lighting, bloom pipeline, or full-screen post-processing claim. Camera following uses frame-time-aware smoothing and a reduced-motion snap option. Entry fades respect reduced motion.

Quality presets can change without recreating the Phaser game:

| Preset | Lights / particles / resolution |
| --- | --- |
| High | Full accents, up to 30 particles, shadows, up to 1.5× device-aware supersampling |
| Balanced | Softer accents, up to 12 particles, shadows, 1× render scale |
| Low | Essential accents, no dust, no decorative prop shadows/scanner cones, 1× render scale |

Supersampling has a 1.8-million-pixel budget; native CSS resolution is retained on larger displays. Device cores, memory when exposed, viewport, and reduced-motion preference choose an initial preset. The player can override it. Only the new `rivals_visual_quality_v2` preference key is written. Reduced motion disables ambient dust/light pulsing/scanner motion, breathing, and entry fade. Basic walking remains legible.

Canvas is retained deliberately for the available software-rendered browser environment. A WebGL lighting experiment should be benchmarked before changing the renderer globally. Effects are bounded and cached, physics is independent of artwork, and frame statistics include active stalls. Cleanup removes observers/listeners, destroys the game and scene resources, and removes its canvas; repeated-entry tests verify this lifecycle.

## Created and modified files

Phase 02 runtime additions:

- `core/presentation.ts`, `core/presentation.test.ts`: quality selection, render scale, independent preference persistence.
- `characters/definitions.ts`, `characters/definitions.test.ts`, `characters/CharacterAnimator.ts`: operative metadata and authored/fallback animation plans.
- `rendering/SceneAssets.ts`, `rendering/CinematicEffects.ts`, `rendering/FrameMetrics.ts`, `rendering/FrameMetrics.test.ts`: selective loading, validation, effects, measurement.
- `world/neonDistrict.ts`, `world/EnvironmentLayer.ts`: prop data, interactions, separated rendering/collision.
- `data/visualManifest.ts`, `rendering/assetIntegrity.test.ts`: generated metadata and file/hash/frame integrity checks.
- `ui/OperativeSelector.tsx`: character selection and lobby graphics control.

Phase 02 runtime modifications:

- `src/pages/GamingPage.tsx`: selected operative and presentation preferences.
- `core/contracts.ts`, `core/session.ts`: typed animation/quality/loading/interaction/metric state and scene controls.
- `assets.ts`: revisioned manifest URLs and texture/download estimates; legacy URLs retained.
- `game/ArenaScene.ts`, `game/createGame.ts`: integrated layered arena, fixed-foot actor, animation, lifecycle, quality resize, audio loading.
- `world/trainingVault.ts`: floor material choices; existing collision geometry retained.
- `ui/Lobby.tsx`, `ui/ArenaView.tsx`, `rivals.css`: roster, selected portrait, inspection control, settings, responsive layouts, load/error feedback.

Tooling and verification additions/modifications:

- New `scripts/audit-rivals-assets.mjs`, `prepare-rivals-visuals.mjs`, `probe-rivals-models.mjs`, `build-rivals-preview.mjs`, `benchmark-rivals.mjs`.
- `package.json`: asset audit/export, QA build and benchmark commands; no new Phase 02 dependencies.
- `vitest.config.ts`: worker limit to avoid exhausting the available Windows test host.
- `playwright.rivals.config.ts`: optional external built-preview URL.
- `tests/rivals/visuals.spec.ts`: three-character, alpha, animation, quality, interaction and corrupt-atlas checks.
- `tests/rivals/arena.spec.ts`, `tests/rivals/index.html`: built-preview support, load/recovery timing, screenshots, data favicon.
- `art/rivals/phase02/`: seven source PNGs plus generation specifications.
- `public/assets/rivals/phase02/`: floor/prop/wall WebP, two shared atlas JSONs, three operative WebP/atlas/portrait sets, manifest (15 files including the manifest).
- This handoff, QA and visual-review documents; machine-readable audits, measurements and screenshots in `docs/rivals-phase02/`.

Existing Phase 0 changes to `App.tsx`, Vite/TypeScript/ESLint config, Phaser dependency, legacy V4 export script, QA harness, and foundation tests remain. They are not new Phase 02 features. The original untracked supplied kit is preserved. No backend files were edited.

## Prompt 03 handoff

Do not assume combat exists. Start from `ArenaScene`, `CharacterAnimator`, and the typed session controls. Keep collision ownership independent of sprites. Future combat should own damage/attack timing and request animation states rather than putting combat behavior inside the animator. Replace fallback action poses with approved directionally consistent authored cycles before calling them complete.

`neonDistrict.ts` is the environment data entry point. `DISTRICT_THEMES` names Neon, Phantom Fortress, and Reactor Zone for future composition; only Neon is loaded and playable now. Future locations need their own art/layout/collision QA and progressive-loading boundaries. Do not load all locations or cosmetics during initial entry.

`OPERATIVE.speed` and `OPERATIVE.radius` currently provide shared movement tuning for all three characters. Legacy `TRAINING_VAULT.props`, `ARENA_ASSETS` and `CharacterDefinition.animation` remain source-compatibility metadata from Phase 0; the live renderer uses `NEON_PROPS`, `VISUAL_MANIFEST`, and `animationPlan` instead. Do not treat the older 96px/idle-frame metadata as the current character atlas contract.

Keep persistent progression, rewards, networking, purchases and entitlement decisions out of this local visual session until their dedicated phase. Reuse the existing application services when those phases are authorized. Run the unit, frame-integrity, collision, touch, pause, corrupt-asset recovery, and repeated-teardown checks after changing the game lifecycle.
