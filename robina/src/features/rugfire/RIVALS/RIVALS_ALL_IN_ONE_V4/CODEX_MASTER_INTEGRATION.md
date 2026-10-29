# CODEX EXECUTION MASTER — RIVALS V3

> ENGINEERING OBJECTIVE: Integrate the working local Rival Heist vertical slice into the user's existing BaseDrop repository as **Rivals**, preserving existing mining behavior and all existing user entitlements. Implement phased, testable changes. Never mark features complete without hands-on tests and screenshots.

## The non-negotiable rules

1. **Audit first**. Inspect the actual repository tree, current auth, wallet/chain configuration, client routes, mining handlers, BD Points, original game mode, USDC payment pipeline, MongoDB schemas, leaderboards, deploy scripts. Do not assume directory structure. Produce a preservation report.
2. **Mining must be identical**. No migration of mining balances, daily rates, timers, claiming semantics, auto-claim, indexes, task logic, or claim-history. No new XP mechanic affects mining. Write snapshot regression tests BEFORE changes and confirm afterward.
3. **Do not replace the whole frontend**. Integrate a new route (`/arena`) inside current React app, preserving existing session/auth handling. The V3 standalone `RIVALS_PLAYABLE_ARENA` is a tested reference implementation, not a drop-in production app. The original Phaser + TypeScript demo in `demo/` is an alternative starting point.
4. Use `RIVALS_PLAYABLE_ARENA/main.js` and `builder.js` as functional references. Extract gameplay into typed, testable modules. Do NOT carry `window.__RIVALS_QA__`, direct LocalStorage score trust, or unbounded client-managed rewards into production.
5. Do not interpret reference concept images as actual sprites. Actual art is under `/assets/` and `/art/`; the 2D gameplay is orthogonal top-down, not genuinely isometric.
6. No pay-to-win purchases. No paid randomized rewards with valuable cash-out prizes without appropriate legal clearance. No premade $RIVALS token. NFT ownership and onchain payments require audited Solidity contracts and tests.
7. One Render **web service** can host Express + Socket.IO; a paid background worker is not inherently required. Free web instance may sleep/restart, so real-time sessions must reconnect. No real-time multiplayer needed for phase 1.

## Phase 0 — Repository preservation and baseline

- List all current pages, API contracts, schemas, env keys, contracts, migrations.
- Capture DB schema and relevant mining snapshots (do not commit secrets/PII).
- Add integration checks for existing user account/login, wallet, BD mining timer, rates, claim, auto-claim, balances and leaderboards.
- Confirm existing treasury and USDC contract addresses from actual configuration, not copied sample strings.
- Output `RIVALS_BASELINE_AUDIT.md` containing risks, backup, migration and rollback procedures.
- STOP if preserving mining cannot be demonstrated.

## Phase 1 — Premium UI shell

- Adopt the `RIVALS_PLAYABLE_ARENA` visual language: sidebar-free game canvas, dark glass panels, yellow primary actions, cyan objective indicators, purple secondary palette.
- Implement mobile and desktop responsive navigation, selectable character cosmetics, world selection, loading, mission HUD, results, and accessibility labels.
- Keep `/mining` visually updated only when necessary, but its behavior unchanged.
- Move art to `public/game-assets/` with a build manifest and file hashes.
- Pass: functional links, correct navigation, no broken assets, screenshot comparison at 390×844 and 1366×900.

## Phase 2 — Playable Arena in Phaser/TypeScript

- Port the currently playable local Canvas vertical slice into reusable Phaser scenes or embed it temporarily behind a React view while you migrate.
- Implement keyboard and touch: 4-way controls, normalization, mobile camera sizing, wall collisions, dash i-frames, attack arcs, enemy pursuit, projectile telegraphs, collision damage, health, timer and pause.
- Implement interactable terminals with timed hacking, Vault Core gate requiring both hacks, extraction win condition, defeat/retry and a visually meaningful results screen.
- Configure at least Training Vault and Neon District with a Tiled-compatible layout and reachable objectives.
- All gameplay objects must have explicit loading and disposal lifecycles to avoid duplicate loops when navigating.
- Pass: human can complete full mission twice in desktop and mobile browser; zero console errors; performance acceptable on low-end Android.

## Phase 3 — Creator Vault Architect

- Port `builder.js` to typed editor components and independently tested validators.
- Grid painting for wall, floor, terminals, core, extraction, drones, traps; drag, erase, preview, JSON import/export, undo/redo as enhancements.
- Server revalidates complete level JSON on publish using restricted schema, flood fill/reachability, object quotas, disallowed overlaps and blocked corridors. Client-side checks are UX only.
- Force creator to beat their own draft vault in an authenticated verified test-run before publishing.
- Published vault revisions are immutable and version-addressed. Add moderation, abuse reporting and visibility controls.
- Pass: invalid locked-off layouts cannot publish; valid layouts work; no XSS via vault metadata or imports.

## Phase 4 — Competition and progression

- Implement server-issued match challenges with random nonce, content hash, authenticated player, versioned scoring rules, expiration and limits.
- IMPORTANT: Do NOT trust raw client-submitted position history, score or victory flag. Implement server-authoritative simulation or sufficiently robust authoritative action replay for competitive results.
- Use ghost recordings only as client-visible convenience; verify best run before public ranking.
- Add asynchronous duels, leaderboard pagination, season levels, Arena XP, non-tradable crafting shards, verified achievements, and anti-bot analytics.
- All new progression resources are separate from existing BD Points. No conversion to mining balances.
- Pass: forging replays/position/score/nonce yields rejection; duplicate award jobs are idempotent.

## Phase 5 — Art, sound and user-experience polish

- Target a consistent approved art bible (lighting, character silhouette, legible traps, contrast). Treat the provided stylized assets as placeholders until truly high-detail sheets exist.
- Upgrade player and enemy sprites to consistent **8-direction**, minimum idle, move, attack, dash, hurt, defeat frames without clipping or frame bleed. Create at least one production boss phase with animated telegraphs and readable contrast.
- Add polished SFX/music with verified usage rights, proper sound toggle and browser autoplay behavior. Add WebGL glow/bloom as enhancement only; provide fallback for phones without it.
- Add map transition/loading indicator, 30/60 FPS quality selector, screen-shake toggle, reduced-motion support, colorblind indicators, gamepad mapping if practical.
- Pass: 30 playtesters across target devices, 100+ actual completed raids; fix stuck locations and unresponsive controls.

## Phase 6 — Revenue and NFTs (only after fun works)

- Fixed-content Base NFT collectibles (ERC-1155 for editions, ERC-721 for unique), standard token URI, inventory indexing, transfers, optional skins; no speculative yield claims.
- Start with cosmetic shop and 1 Season Pass tier (suggested $4.99, a test price, not a forecast). Sponsored branded vault campaigns can be tested manually before self-service.
- USDC purchase: authenticated order with immutable SKUs and inventory, verified onchain payment (chain ID/token contract/recipient/amount/tx log/order), retries idempotent, reorg handling, refunds/reconciliation.
- Audit smart contracts and test on Base Sepolia. Do not deploy mainnet paid features without external review.
- Preserve prior card purchases and entitlements in a Legacy Vault history, and retain all obligations to existing users.
- Pass: transaction success/failure/double-submit/bad chain/wrong token/replay transfers all covered by tests.

## Phase 7 — Launch readiness

- Security: dependency scan, auth/session review, rate limits, server validation, WebSocket auth/reconnect, telemetry with privacy protections.
- Hosting: frontend Vercel, existing Express backend Render, MongoDB; no separate worker required for Socket.IO. Introduce Redis/BullMQ only when async job load requires it. Render Free is not ideal for uninterrupted live matches.
- Product: run moderated soft launch, gather retention and session data, fix crash and difficulty issues, analyze conversion only after users demonstrate enjoyment.
- Final checklist: no cross-app mining regression; backups and rollback tested; support and escalation path; trademark/domain review for 'Rivals'.

### How to work with this prompt

Run exactly one phase at a time. At the end of each phase, Codex must list files edited, tests actually executed with outputs, screenshots or recordings captured, manual steps required, remaining failures, and explicit confirmation that mining regressions still pass. Do not silently mark TODO implementations as complete.
