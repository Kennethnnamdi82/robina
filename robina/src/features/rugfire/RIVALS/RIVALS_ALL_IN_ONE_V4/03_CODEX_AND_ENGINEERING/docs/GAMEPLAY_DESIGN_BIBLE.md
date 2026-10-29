# RIVALS — Rival Heist: Detailed Gameplay Design Bible v1

## Player promise
A thrilling 2–4 minute mission with skill-based movement, readable hazards, tactical decisions, replayable scores and fair cosmetic customization. Rivals' primary game is **top-down competitive vault raiding**. Mining is a legacy independent system and must not be modified.

## Five-minute player journey
1. Connect existing wallet/account; select a free operative.
2. Play Training Vault: WASD / mobile virtual pad; dodge a visible laser; hack a terminal; take the Vault Core; extract.
3. Receive offline preview stats; production backend verifies results before awarding nontransferable Arena XP and Crafting Shards.
4. Attempt Neon District, improve your time and choose a personal rival's ghost challenge.
5. Equip earned cosmetic, optionally claim an eligible achievement NFT, or purchase a fixed-content skin.

## Mission verbs
Move, dash, attack (basic melee), evade, interact, solve short puzzles, pick up objectives, extract. Each action has an explicit visual/audio cue. Dash has a cooldown; damage uses temporary invulnerability and visible hit feedback. No gameplay-dependent loot boxes.

## Basic enemy systems
- Drone: detect player, chase within a bounded radius, attack, return to patrol.
- Sentinel: slower, tankier, more visible wind-up.
- Turret: stationary area denial with telegraphed beams.
- Spider: faster pursuit, low health.
- Guardian: boss with telegraphed three-phase pattern, no unavoidable hits.

## Daily/weekly progression
Daily three missions max for optional XP bonus (not a gate to playing), weekly self-improvement record, free season milestones, achievement-based rewards. No punishment for missing a streak; respect notification preferences. Infinite free missions, but server-authoritative economies and abuse limits.

## Vault Architect
Grid editor snap/undo/redo/save. Each vault has one entrance, at least one extraction, permitted total traps/enemies, optional two terminals, and a proven reachable path. Creator MUST test-complete before publishing. Submissions get immutable version hash; leaderboard scores are pinned to a vault version. Upon editing, a **new** version is created and old records remain associated with old versions. Block malicious layouts and exploit objects server-side. No premium mechanical advantages.

## Competition & anti-cheat
Phase one: asynchronous time trials and ghost replays. Server issues mission ID, seed, object layout version and signed session nonce. Server records inputs/events or deterministic replay and independently verifies completion and score; client's `score` is display-only. For rewards worth money, separate exploit review, tamper protection, fraud monitoring and legal sign-off. Do not deploy cash wagers by default.

## NFT economy
- ERC-1155 for editioned cosmetics, ERC-721 for unique special pieces.
- Wallet connected with least privilege, chain ID check for Base, onchain event indexing for ownership.
- Fixed-price mint using USDC with idempotent fulfillment and clear refunds policy.
- NFTs only grant cosmetic entitlement, commemorative badges, or non-competitive access.
- Do not promise resale appreciation.
- Offchain crafting materials are not tokens and have no cash conversion.
- Creator campaign analytics must be privacy conscious.

## Match score example (illustrative only)
`score = 1000 + 15 * whole_seconds_remaining + 250 * terminal_count + 450*core_recovered - 3*damage_received`.
All results require authoritative verification before persistence. Tie-break: faster validated completion, then less damage, then earlier accepted verified timestamp.

## Minimum accessibility requirements
Readable HUD at 360px screen width, subtitles for combat warnings, reduced flashes, optional camera shake, control remapping, keyboard and mobile touch controls, adequate target sizes, and sound on/off. Keep 60FPS target on modern mid-range Android; gracefully degrade to 30FPS on weak hardware.

## Analytics that matter
Day-1/7 retention; tutorial completion; first-raid time; failure points; matchmaking quality; creator vault publish success; percentage of paid cosmetics equipped; mission performance and crash rates; user support tickets. No addiction manipulations, gambling-like surprise spending or hidden negative consequences.
