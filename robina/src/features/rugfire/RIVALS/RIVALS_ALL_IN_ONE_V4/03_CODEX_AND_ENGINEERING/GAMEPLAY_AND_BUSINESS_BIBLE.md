# RIVALS — Gameplay & Revenue Design Bible

## Positioning

A free-to-play, skill-first 2D vault-raiding action game with user-created challenges, cosmetic digital ownership, progression, cooperative events and **the old BaseDrop mining feature preserved unchanged**. Rivals is not an NFT casino, a token-yield product, or an app where paying for a randomized card is the game.

## Core 3-minute loop

1. Pick an operative and operation zone (training vault first).
2. Infiltrate a vault. Navigate walls, drones, projectiles and timed hazards.
3. Hack two terminals through a timing puzzle. Observe enemy telegraphs and dodge.
4. Unlock and retrieve the Vault Core.
5. Escape to extraction before the timer expires or health runs out.
6. See validated completion time, damage, enemies defeated, score, XP and cosmetics progress.
7. Improve the run, attempt a friend's vault, create a vault, or return for a season challenge.

## Why it can be compelling

- **Player competence**: each retry teaches routes, timings and hazard handling; paid cosmetics do not change fair competitive mechanics.
- **Social rivalry**: players can contest the same immutable vault version with a replay ghost (when server-verified).
- **Creation**: players design vaults under published rules; they must complete their own vault before release.
- **Ownership**: avatars, vault skins, achievement badges and optional evolving cosmetic NFTs tie to specific achievements.
- **Progression**: season rewards motivate completing a varied set of challenges; daily quests are optional and not coercive.

## Modes and rollout

| Mode | How it plays | MVP? | Revenue link |
|---|---|---|---|
| Heist: Story Vault | Hand-authored, learnable missions | YES | Season cosmetics |
| Vault Architect | Edit and validate vaults | Prototype now; server validation later | Decorative vault theme sales |
| Ghost Rival Duel | Try to beat another run on same seed/version | Local demo now; server verification later | Cosmetic win animations |
| Boss Raid | Guardian with telegraphed attacks, limited windows | Simple boss reference now | Sponsored cosmetic campaign |
| Crews | Teams coordinate challenges | LATER | Crew customization |
| NFT Forge | Craft visual collectible content | LATER | Fixed-content cosmetic blueprints |
| Creator Studio | Sponsor pays for branded vault/event | MANUAL FIRST | B2B campaign fees |
| Marketplace | Eligible NFT resale | LATER | Fee on completed internal sales |

## Game economy (initial; adjust after playtests)

- **Existing BD Points:** Mining only. Exact existing rate, timer, claims, auto-claim, balances and database semantics unchanged.
- **Arena XP:** Non-transferable, awarded for validated gameplay activity; progress-based only.
- **Arena Rating:** Competitive measure; no real-money payout promise, rating cannot be bought.
- **Crafting Shards:** Non-tradable cosmetics crafting items earned through play; no cash-out or market price.
- **Cosmetic NFTs:** Transferable where appropriate, clearly specified collections on Base; not automatically investments.
- **USDC:** Payment token only for optional *fixed-content* cosmetics/passes with secure fulfillment.

## UX quality targets for the team

- Player can move in < 5 seconds after starting a mission; no wallet transaction required to play.
- Mission finishes in ~2–4 minutes, with player choice and a clear failure explanation.
- After death, restart is a single action; no mandatory paid retry.
- Traps telegraph enough time for reaction; red warnings are also communicated by shape/icon/audio for accessibility.
- Distinct game states: start, interact, hit, defeated, hacked, core secured, extraction, victory.
- Target stable responsive 30 FPS on budget Android and 60 FPS on desktop with quality presets; verify on actual hardware rather than assuming.

## Revenue: reasonable first experiments

| Product | Price to test (not guaranteed demand) | Benefit | Fairness |
|---|---|---|---|
| Season Pass | $4.99 / season | Cosmetics, banners, profile FX, collectible art | Same combat stats for everyone |
| Cosmetic character NFT | $1.99–$9.99 | Appearance and ownership | No faster movement/damage |
| Vault decorative pack | $1.99–$4.99 | Visual design and decorations | Traps/levels have same budgets |
| Sponsored vault | $49–$199+ | Branded challenge with disclosures | No hidden prize odds |
| Future marketplace fee | e.g. 2% on Rivals-facilitated sales | Trading infrastructure | Transparent costs |

None of these prices are validated. For early-stage marketing, avoid forecasting the exact volume and test whether existing BaseDrop players actually complete raids and return.

## Anti-cheat and server flow

A ranked mission must be created by the server and associated with an authenticated player, vault version hash, mission seed, session ID, expiry, and attempt limits. Validation must be server-authoritative or robust server action replay with deterministic level data. Client-reported score is for UI ONLY. All reward grants are idempotent and bounded. Ghost replays are visual aid, not proof of eligibility. Rate-limit publications and prevent impossible layout versions. Never use `localStorage` state to grant NFTs, USDC, or financial prizes.

## Payment architecture

The initial free game should not depend on Base transactions. For cosmetics, create immutable product SKUs, payment orders and receipts; verify correct Base chain, contract/token, recipient, amount, onchain events, and transaction finality. Use an independently reviewed contract or well-audited order fulfillment pipeline. Asset ownership must be indexed from actual blockchain transfers. A marketplace's ERC-2981 royalty signaling alone does not enforce payouts.

## Mining preservation

Keep existing mining code, claim formula, timers, BD Points and history intact. Implement a new Arena schema and collection. Do not retroactively reinterpret historical BD Points or the old 8-card treasures. Preserve archived entitlements and clearly announce legacy changes.

## Render cost-control plan

Vercel can host frontend; your existing Render Express web service can host both API and Socket.IO on one port. No new paid background worker is required for Socket.IO alone. Single-player and asynchronous ghosts need no always-on socket. A worker is useful later for reliable indexing and async processing but can initially be an in-process queue with explicit restart/replay handling; never use that shortcut for financial settlement. Free Render web services spin down after 15 minutes of no inbound traffic and can restart, so do not promise uninterrupted matches. Source: https://render.com/docs/free and https://render.com/docs/websocket.

## KPI dashboard

Track first successful mission rate, median mission duration, day-1/7 retention, restart after defeat, most frequently abandoned objective, mobile frame-rate distribution, player-created-vault publication success, score dispute volume, refund rates, pass purchase conversion and revenue after costs. These metrics decide what to build next.
