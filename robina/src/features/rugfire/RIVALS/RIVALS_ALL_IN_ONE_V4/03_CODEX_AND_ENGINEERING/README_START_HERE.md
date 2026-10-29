# RIVALS // RIVAL HEIST — CINEMATIC BUILD V3

**The first Rivals kit that includes a browser-tested, dependency-free interactive vertical slice, not merely an asset catalogue.**

This package substantially improves the previous release, but it **does not guarantee a 10/10 commercial game**. The 10/10 target is a quality bar requiring exceptional final artwork, playtesting, gameplay tuning, accessibility, and (if monetized) audited contracts. Do not confuse generated concept boards with game-ready sprite animation.

## Start in under a minute

From a terminal:

```bash
cd RIVALS_PLAYABLE_ARENA
python -m http.server 8080
```

Then visit **http://localhost:8080** on your PC. If Python is unavailable, use `npx vite --host 0.0.0.0` or any static HTTP server. **Do not just double-click index.html**: browser security blocks local JSON map loading via `file://`.

No npm packages, API keys, blockchain accounts, Redis, Socket.IO or Render worker are needed for this **local single-player demonstration**.

### What actually works

- Responsive desktop lobby; 3 selectable operatives; 3 themed zones.
- Canvas-based playable top-down movement, wall collisions, camera follow, hit/dodge, enemy pursuit and telegraphed shots, health, timer, and mission scoring.
- Two interactive hacking terminals with a skill-based timing minigame; Vault Core; extraction; game-over/win feedback.
- Touch joystick + 3 action buttons; mobile viewport-specific camera canvas; keyboard controls.
- Self-contained **Vault Architect** with walls, traps, drones, spawn, terminals, core, exit, grid manipulation, path validation, 85 wall/8 drone budgets, JSON export/import, and test-run in the game.
- Local personal-best **ghost replay** after a complete run, not live multiplayer or authoritative results.
- 9 collectible concept cards in an Armory showcase. **No NFT minting, real USDC payments, or ranking payouts** in this demo.
- Original existing Ultimate V2 graphics, maps, source files, prompts, tests and documentation remain preserved in the same package.

### Critical caveats

- The original sprite artwork remains relatively simple, stylized and robotic; it is *not* the photo-detailed concept art. We added 3 higher-resolution original operative portraits and 3 new environmental feature illustrations, but 8-direction frame-by-frame premium animation remains to be produced.
- This playable demo is made in **plain Canvas 2D + JavaScript** so it runs without npm or a hosted server. The earlier **Phaser + TypeScript scaffold** is included under `demo/`, still requiring `npm install` before running. Codex should port/factor the final implementation into Phaser or your React app.
- LocalStorage scores and ghost replay are **not trustworthy** for paid rewards or leaderboards. They must be replaced by validated server-side runs before ranked features go live.
- Existing mining was not edited because your BaseDrop source repository wasn't supplied here. When integrating, preserve mining **exactly**, including balances, timers, auto-claim, rates, claims, and history. Treat it as read-only during the game migration.
- This package has no professionally audited NFT or payment smart contracts. Integration instructions are in `CODEX_MASTER_INTEGRATION.md`.

## Files to inspect

| Path | What it gives you |
|---|---|
| `RIVALS_PLAYABLE_ARENA/index.html` | Playable Arena, Vault Architect and Armory |
| `RIVALS_PLAYABLE_ARENA/main.js` | Standalone game simulation and visual rendering |
| `RIVALS_PLAYABLE_ARENA/builder.js` | Real editor and flood-fill vault validation |
| `RIVALS_PLAYABLE_ARENA/style.css` | Responsive dark sci-fi interface |
| `RIVALS_PLAYABLE_ARENA/art/` | 3 original environment cards + 3 original high-res portraits |
| `RIVALS_PLAYABLE_ARENA/assets/` | 351 older catalogued asset entries, maps, sprite atlases, audio |
| `GAMEPLAY_VISUAL_PREVIEW.png` | Rendered concept composition from source sprites; NOT screenshot |
| `QA_LOBBY_BROWSER.png`, `QA_GAMEPLAY_BROWSER.png`, `QA_BUILDER_BROWSER.png`, `QA_MOBILE_BROWSER.png` | Actual browser QA screenshots from isolated HTML/JS harness |
| `CODEX_MASTER_INTEGRATION.md` | Detailed, phased Codex engineering instructions |
| `GAMEPLAY_AND_BUSINESS_BIBLE.md` | Systems, monetization, balancing and risk management |
| `QA_RESULTS_AND_LIMITATIONS.md` | Actual validation results, missing tests, release gates |
| `README.md` | Original version 2 kit README preserved under `README_V2.md` |

## Keyboard and touch

**WASD / arrows** move; **SHIFT** dash; **SPACE** attack; **E** interact; **ESC** pause. During hacking, press SPACE when marker is over the green target band. On mobile, use the on-screen joystick and buttons.

## Research references

- Phaser 3 docs: https://docs.phaser.io/phaser/concepts/physics/arcade
- Phaser visual effects (WebGL-only): https://docs.phaser.io/api-documentation/3.90.0/class/renderer-webgl-pipelines-fx-glowfxpipeline
- Render WebSockets: https://render.com/docs/websocket
- Render free plan constraints: https://render.com/docs/free
- Kenney CC0 licensing: https://kenney.nl/support

No third-party commercial artwork was bundled; the optional Kenney packs remain links in the earlier docs.
