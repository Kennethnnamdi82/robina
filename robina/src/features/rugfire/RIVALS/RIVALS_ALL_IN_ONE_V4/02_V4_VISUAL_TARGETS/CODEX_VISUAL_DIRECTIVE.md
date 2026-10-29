# CODEX: RIVALS — VISUAL MATCH IS THE PRIMARY ACCEPTANCE CRITERION

## Product vision
Rebuild the existing browser-based `RIVAL HEIST` so the live game, not merely a screenshot, visually matches `visual_reference/RIVALS_ORIGINAL_MASTER_REFERENCE.png`. The V4 playable prototype is a **technical starting point**, not a final art target. Avoid minimalist wireframes, hollow outlined characters, plain rectangles, and generic sci-fi gradients. The user's original image is the visual truth.

## Exact target screens to replicate
1. `01_lobby_and_navigation.png`: left profile stack, full-color chibi operative on dimensional platform, large vault/operation art, four gameplay mode cards, dark glass nav.
2. `02_rivals_world_map.png`: illustrated explorable geography, clear colored destinations, hovering labels and animated zones; cannot ship a single flattened screenshot as the final implementation.
3. `03_exploration_gameplay.png`: richly lit floor, raised metal walls, detailed player sprite, red laser hazards, amber machinery, roaming drones, cyan dash trails, health/time, mini-map, movement + attack HUD.
4. `04_terminal_puzzle_gameplay.png`: interactive blue/red laser maze, functional terminals, safe path visualization.
5. `05_boss_combat.png`: huge articulated, animated orange mech guardian, staggered red projectile arcs, camera impulses and warning zones.
6. `06_mission_results.png`: polished victory panel and reward illustrations; same UI style as gameplay.
7. `07_vault_architect.png`: grid-based vault designer with drag/drop palette and real play validation.
8. `08_nft_wardrobe.png`: equipment preview, custom character skins, NFT art cards, optional cosmetics only.

## Mandatory distinct exportable source assets
- Operatives VEX, NYX, ROOK at min 128×128 visible art, 8 directions × idle/walk/run/dash/attack/hurt/death, enough frames to move fluently. Transparent PNG sprite sheets + Aseprite or equivalent original editable illustration files where available, with frame manifest JSON, pivots and durations.
- Security enemies: 3 types with idle/patrol/alert/fire/hit/destruction. Guardian boss min 384×384 game-ready art, idle/telegraph/attack/hit/phase-change/death with actual frame geometry.
- Tilesets min 128×128 source art per piece (export to 64×64 for runtime only where it remains sharp), 3 connected biome palettes, seamlessly joining raised walls, corners, floors, doors, grates, decorations and interactive objects. Separate collision tiles from deco.
- Layered lighting: dark ambient + bloom-emissive masks, radial colored lights, sparks, beam particles, silhouettes, decals, transparent overlay textures. Honor mobile performance.
- UI kit as separate SVG/PNG components with editable text: nav, cards, inventory, icons, bars, minimap, result UI, tabs, buttons, type scale and accessible touch targets.
- 3 complete playable maps and a boss arena (not simply four screenshots). Game map source in Tiled JSON with independent collision layers and correct spawns, objective markers, item/weapon placements.
- All artwork must be consistent in camera projection, human proportions, shadow direction, perspective and scale. Keep 60 FPS target on midrange mobile, with lower-quality effects option.

## Iteration protocol
Step 1: Identify every UI layout component and draw an original asset inventory using all 8 precise reference crops. Step 2: Re-create source assets (never fake sprite sheets by copying a complete screenshot); every sprite must have transparent background, contiguous animation poses, exact geometry and collision guidance. Step 3: Render in-browser scene screenshot at exact matching framing. Step 4: Compare side-by-side with supplied target. Step 5: Visually tune by section. Step 6: Test movement, combat, traps, puzzles, boss, vault creation and touch. Step 7: Run basic accessibility and performance checks. Step 8: Repeat until approved based on visual and gameplay evidence.

## Explicit anti-shortcut constraints
Do not treat the reference montage as a functional game map. Do not claim exact visual fidelity just because it is shown as a background. Do not replace detailed characters with rectangles, icons or flat colored silhouettes. Do not claim production-ready multiplayer, marketplace, wallet payment, NFTs, or mining changes when not built and tested. Maintain existing mining system completely unchanged, including mining timer, BD Points calculation, claims and historical balance. The new Arena XP/skins are independent.

## Local development
Run the V4 demo from an HTTP static server. UI uses plain JS, not Phaser yet; Codex may migrate game rendering to Phaser if it preserves behavior. The underlying demo's map and scoring are local only—do not trust client scores for rankings.
