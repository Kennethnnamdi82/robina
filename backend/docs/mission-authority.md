# Mission authority integration

## Data ownership

`MissionSimulation.ts` imports the repository's actual assignment definitions,
CharacterController, TacticalEnemy, Health, Loadout, Projectile3D, FieldItems,
WorldState, collision rules, VehicleController, PolicePursuit and
CampaignGameplay. The backend bundles these rules without WebGL, DOM assets,
audio or renderer construction. The client renderer uses owner snapshots and
local movement/shot presentation prediction. Downloaded vehicle art no longer
defines a different collision size from the server.

The client cannot submit health, damage, kills, world position, checkpoint
snapshots or successful results as authoritative evidence. Its input schema
only permits movement/aim/trigger intent and bounded discrete interactions.
Unknown fields, duplicate input sequences, out-of-range actions and forged
completion reports are rejected or ignored. This protects stored results;
it does not claim to eliminate aim assistance or all forms of cheating.

## Death and results

Accepted server projectile/hazard damage uses the existing invulnerability,
dodge and damage rules. Each health event has an idempotency key scoped to the
server connection epoch. Reaching zero atomically fails the mission and sets
`MissionLife.recoveryUntil` two hours ahead using server time. Admission and
death share a transactional life gate so racing mission starts cannot bypass
recovery. The server then persists a verified failure and publishes the final
state. Voluntary abandonment cannot overwrite that terminal transition.

Successful extraction must pass the existing mission prerequisites, actual
carried item, location and police-response conditions. The server persists the
verified result before publishing `mission:result`. Timing begins at the first
ready signal and includes subsequent pauses/disconnections. Scores use the
25/25/20/15/15 weights, with a versioned 0–10,000 scale. First successful
completion is eligible for Phase 4 rewards. Replays may rank but cannot earn
those rewards again. Phase 2 does not mint XP, coins, USDC or purchase credit.

## Persistence and reconnect

MongoDB contains sessions/configuration seed, server health, life deadlines,
combat-event deduplication, grenade spending, checkpoints and verified results.
Checkpoint state includes controller cooldowns, objective sets, weapons and
magazine/reserve ammo, enemy AI state, pickup/bomb state, cars, pursuit and
mission counters. Snapshots are captured on insertion and objective progress.
Movement frames are not stored in MongoDB.

The simulation pauses on disconnect. A newly authenticated connection within
five minutes restores the last checkpoint and resets later stats/enemy/pickup
changes. Grenades spent after that checkpoint are deducted again from the
restored temporary inventory. A failed/settled mission cannot reconnect into
an active simulation. A late interruption expires with zero rewards and no
death penalty unless a death was already committed.

Recovery-product fulfillment is an internal `consumeVerifiedLifeRecovery`
interface. It can consume a previously verified, unexpired entitlement once;
there is no public payment-claim or cooldown-reset route. Phase 6 must provide
payment verification before creating those entitlements.

## Deployment

Deploy the repository with both `backend` and `robina/src` present. The backend
prestart build reads the shared source from the sibling frontend directory.
Run a single always-on Render instance. Set `MISSION_SOCKET_ORIGIN` to its
HTTPS origin when `RENDER_EXTERNAL_URL` is absent. Existing frontend
`VITE_API_URL` still configures the authenticated HTTP relay/native backend.
Socket origins allow the existing configured frontend origins and Capacitor's
`https://localhost` origin. Tickets contain no treasury or session-cookie data.

Existing APKs do not acquire new bundled JavaScript through a Vercel deploy:
build/sync/package a new APK for this client/native policy change. Browser
clients require the new frontend deployment as well as the backend deployment.

## Verification boundaries

`liveMissions.test.js` uses an isolated MongoDB replica set and actual Socket.IO
connections. A guard fixture fires through the actual AI/projectile pipeline
to verify death, database cooldown, failure settlement and rejection of later
starts/abandonment. An extraction checkpoint fixture verifies the real handoff
checks, idempotent success and replay reward eligibility. Separate cases test
checkpoint restoration, ticket ownership/replay, strict inputs and actual
bank/laboratory objective sequencing.

Run `npm test` from `backend` to rebuild the shared rules and execute the
isolated database/transport tests. From `robina`, run `npm run typecheck` and
`npm run test:e2e:missions` for the real React/Three.js client with a local,
isolated replica set. The browser fixture's `/__test/*` endpoints exist only
in that test script and are never registered by the production app. Set
`PLAYWRIGHT_CHROME_PATH` for a different installed Chrome executable, or
`RIVALS_SOFTWARE_RENDERER=1` if the test host needs SwiftShader.

Owner snapshots are coalesced to the actual browser rendering cadence rather
than accumulating HUD work on slow devices. Terminal results are delivered
immediately, and authenticated session inspection recovers a persisted result
if its final socket packet was lost. Client HTTP heartbeats cannot extend the
server-controlled recovery window.

These are controlled integration fixtures, not a completed human playthrough
of every mission or a physical Android device test. Renderer, aiming,
prediction/reconciliation and latency must also be play-tested on desktop and
phone before a broad release. Street civilians and social venue presentation
remain client presentation; local venue currency is not accepted as verified
health or a production revival entitlement. Venue reward/purchase settlement
requires the later progression/economy integration.
