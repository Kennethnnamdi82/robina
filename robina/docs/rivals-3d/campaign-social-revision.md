# Campaign, city life and focused menus

## What changed

- Bounty & Earn has four separately routed screens: Contracts, My Bounties, Wallet and Notifications. Submission success opens My Bounties. Wallet and notification content no longer crowd the contract board. Existing Phase 1 demo restrictions and per-profile isolation remain intact.
- Leaderboards defaults to actual device-local contract results, grouped by contract. Search and sorting share one ranked list. Fictional exhibition standings are a secondary, explicitly labelled view; no live global ranking is invented.
- The campaign has nine named assignments. Original save indices are retained. Toll of the Dead and Last Light Payday are guarded bridge interceptions, with concrete cover instead of another laboratory building. The final bridge assignment uses night lighting.
- Bridge arrival requires a vehicle. Its security objective requires defeating the actual bridge guards, not pressing a bypass panel. The GPS continues through recovery, evasion and extraction.
- Mission briefings describe the actual access steps, hold duration, transport/escort requirements and handoff conditions. Briefings also preview the exact cash and coin award.
- Selected contracts end at the Broker's private table, with a seated boss drinking wine and accompanying gang members. Explicit handover completes the mission, displays the delivered case and pays the player's share. Pursuit must be lost first.
- First-person weapons now include ten visible glove digits, an articulating trigger finger and a support hand that releases during reload. Third-person finger bones receive a stable grip pose; switching weapons does not compound the curl.
- The Amber Room bar and Casa Meridian restaurant have open doorways, shared art/collision footprints, tables, seated patrons, food, wine, staff and bar dancers. Orders trigger eating/drinking/party gestures; meals can restore health. Static furnishings and glove parts are batched to limit draw calls.

## Player instructions

Complete a contract to earn fictional campaign cash and achievement coins. The lobby displays both balances and the number of paid runs. During a mission, pause and choose **BAR & RESTAURANT / SET GPS** to route to a venue. Enter on foot and use **E / COLLECT** near the waiter. Lose active police pursuit before ordering. Closing or purchasing clears the venue detour and restores mission navigation.

Being defeated in a campaign offers a coin-funded revive. A successful revive restores 65% health and grants three seconds of protection; declining ends the run. Escape/Android Back does not silently discard this decision. Failed or abandoned runs receive no payout. Successful completion offers the next distinct assignment; replay is still available.

## Fictional campaign economy

| Contract | Cash share | Achievement coins | Revive cost |
| --- | ---: | ---: | ---: |
| The Last Deposit | $20,000 | 1,500 | 1,000 |
| Cold Reaction | $27,500 | 2,500 | 1,000 |
| Ghost in the Glass | $35,000 | 4,000 | 2,500 |
| Running Red | $42,500 | 5,000 | 2,500 |
| No One Left Behind | $50,000 | 6,500 | 2,500 |
| Midnight Manifest | $57,500 | 8,000 | 5,000 |
| Black Standard | $65,000 | 10,000 | 5,000 |
| Toll of the Dead | $72,500 | 12,000 | 5,000 |
| Last Light Payday | $80,000 | 15,000 | 5,000 |

Cash can only purchase the social menu. Coins can only fund revives. Rewards are idempotent per completed run; each defeat/order has its own transaction identity. Replaying a contract is allowed. These balances have no real-money value and never access bounty USDC, store payment APIs or account balances. They are saved only on this device for the current profile, with an in-memory fallback if storage fails. They are not server-authoritative or cross-device synced.

## Verification scope

Automated tests cover route separation, submissions and review states, personal leaderboard grouping/search, bridge-driving and guard gates, boss handoffs, currency separation, duplicate payouts/spends, insufficient balances, storage failure, revive choices and social menus. Chrome checks exercise desktop, small-phone and landscape layouts, real supplied 3D asset rendering, and the loaded runtime's meal, revive and handoff flow. Scene captures are generated in `test-results/command` and `test-results/rivals3d`.

The work extends the current supplied assets and renderer. It is not a replacement AAA character asset pack. Physical-device Android performance and release signing/distribution require a separate device/release check; browser emulation is not evidence of physical-device testing.

Final local verification (2026-11-11): all 454 frontend tests across 70 files passed; TypeScript passed; changed-code lint had no errors (the existing RaidApp lifecycle-ref warnings remain). The production Vite build passed. Bounty and leaderboard responsive Chrome checks passed, as did real-asset hand/social-scene rendering, the loaded-runtime economy flow, and two compiled-production leaderboard/gameplay checks including the short-landscape GPS dialog. Capacitor Android sync and package verification passed; the packaged BountyPage, GameHub and RaidApp JS/CSS hashes match the production build. No new APK was signed or published, and no production deployment was performed for this revision.
