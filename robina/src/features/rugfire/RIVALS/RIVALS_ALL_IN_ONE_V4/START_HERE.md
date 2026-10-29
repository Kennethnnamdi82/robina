# RIVALS — ALL-IN-ONE V4 CODEX KIT

This single ZIP combines the most recent V4 playable/visual package and the earlier V3 development materials, so you do not need to download two ZIP files.

## START HERE
1. Open `01_V4_PLAYABLE_GAME/` and run `python -m http.server 8000` **inside that directory**, then open http://localhost:8000 to try the local playable prototype. No blockchain account is needed.
2. See `02_V4_VISUAL_TARGETS/V4_NEW_SPRITES_PREVIEW.png` and `02_V4_VISUAL_TARGETS/visual_showroom/index.html` to compare usable art with the desired target.
3. For Codex, start with `03_CODEX_AND_ENGINEERING/CODEX_MASTER_INTEGRATION.md` and `03_CODEX_AND_ENGINEERING/docs/prompts/01_AUDIT_AND_INGEST.md`, then work through the prompts in order. Read `02_V4_VISUAL_TARGETS/CODEX_VISUAL_DIRECTIVE.md` as art direction.
4. `04_PHASER_TYPESCRIPT_DEMO/` contains the separate V3 Phaser/TypeScript demo and a second set of prototype assets. Codex should audit it before porting/replacing the V4 standalone canvas prototype.
5. `05_ASSET_LIBRARY_V3/` preserves the earlier original assets so no previous material is lost.

## WHAT IS VERIFIED vs NOT
- These include actual transparent sprite sheets, tiles, artwork, example audio, playable local browser code, vault editor prototype, Phaser/TypeScript demo code, prompts, and design documentation.
- The 2D visual targets are concept-art images, *not* individually animated game sprites.
- The playable game does **not** look pixel-identical to the cinematic concept; actual current art is much simpler.
- This package is **not** a finished professional game, full online multiplayer product, production NFT system, or safe onchain payment implementation.
- The original BaseDrop mining code is not included or altered; integration into an existing repository must preserve it.

## CONTENTS
`01_V4_PLAYABLE_GAME/`: latest locally playable standalone V4 prototype.
`02_V4_VISUAL_TARGETS/`: visual showroom, target panels, source art previews, art-direction instructions.
`03_CODEX_AND_ENGINEERING/`: master integration, game design, Codex prompts, tests and technical docs.
`04_PHASER_TYPESCRIPT_DEMO/`: earlier Phaser + TypeScript game development demonstration.
`05_ASSET_LIBRARY_V3/`: previous general asset library including raw transparent art/audio assets.
`06_REAL_PROTOTYPE_SCREENSHOTS_V3/`: screenshots of actual browser-rendered V3 prototype (not the cinematic targets).

This package combines available work; it does not magically upgrade original sprite quality. Use the V4 playable game and visual target to guide iterative development, with Codex testing the result in a browser.
