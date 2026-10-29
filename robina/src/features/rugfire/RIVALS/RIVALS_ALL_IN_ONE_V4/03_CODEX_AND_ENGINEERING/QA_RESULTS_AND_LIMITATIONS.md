# RIVALS V3 — QA evidence & limits

## Tests actually executed

- `node --check RIVALS_PLAYABLE_ARENA/main.js` — passed.
- `node --check RIVALS_PLAYABLE_ARENA/builder.js` — passed.
- `python tests/validate_assets.py` — validated **351 prior manifest entries and four map files; zero errors**.
- Node JS unit assertions: 7/7 pass (starter valid, core missing, too many terminals, overlapping objects, invalid dimensions, unreachable objectives, out-of-bounds object).
- Node JS `starterVault()` / `validateVault()` — default vault passes: 257 reachable cells, 79 walls, 2 terminals, 1 spawn, 1 core, 1 exit.
- Automated browser DOM+JS smoke (browser restricted direct local navigation; loaded exact HTML/CSS/JS inline with image data URLs and mocked local map HTTP responses): no uncaught JS errors.
- Browser flow: launch Neon District, game state becomes active, character moves from x=224 to x≈349 after 'D' input, builder validates, custom vault test-run loads, result modal displays, 9 collectible images appear.
- Mobile viewport 390×844: no horizontal overflow, game starts, simulated terminal timing hacks twice, core interaction, extraction success, modal displays. No uncaught JS errors.
- Actual browser evidence files: `QA_LOBBY_BROWSER.png`, `QA_GAMEPLAY_BROWSER.png`, `QA_BUILDER_BROWSER.png`, `QA_MOBILE_BROWSER.png`; text outputs `QA_BROWSER_REPORT.txt`, `QA_END_TO_END_REPORT.txt`.

## Test caveats

- Browser automation ran against the actual source code **inlined into a controlled test document** because this sandbox blocks normal browser navigation to `http://localhost`. Assets were loaded from data URLs, and map requests from bundled JSON. This is meaningful logic/UI smoke testing, but **not** a real HTTP-hosted deployment and not a certification of production stability.
- Hacking/completion E2E test used programmatic character repositioning and timing-marker positioning to exercise puzzle, gate, core and extraction paths. This does **not** prove a human can complete a long mission using only input controls.
- Browser playtesting with real users and target Android hardware is still required. Audio autoplay, actual frame rates, long-session memory, gamepad, orientation changes, PWA cache, and network connections need further testing.
- Phaser/Vite demo from the earlier kit was NOT npm-built here: this environment cannot resolve npm package registry. Use `npm install && npm run build` when online.
- No independent security audit has been performed. Contracts, rankings, live PvP, financial rewards, backend and wallet auth are not in this offline demo.
- Current 2D sprite sheets are still simple vector-style art and have limited poses. More detailed, cohesive character animation and authored maps are needed to meet cinematic reference fidelity.

## Release gates before calling it 10/10

1. 8-direction high-detail character/enemy/boss animations with consistent silhouette, effects and collision boxes, no broken frames.
2. Design at least one complete 3-minute level with meaningful route choices, refined attack telegraphs, tested pacing and no soft locks.
3. Real Android 30+ FPS and desktop 60 FPS under normal load; reduced motion and game audio settings.
4. Proper server-authoritative competition with anti-cheat and verified replay inputs, no client score trust.
5. Creator vaults server-validated, replayable, immutable versions, creator test-run gate and content reporting.
6. Secure wallet/auth and asset ownership indexing; independent review before accepting USDC/NFT payments.
7. All existing mining calculations, balances, timers, auto-claim and claims pass migration regression tests.
8. Closed beta across 30 users and 100+ completed sessions with prioritized bugs fixed.
