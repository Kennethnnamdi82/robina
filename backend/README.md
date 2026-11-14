# RIVALS backend

**Current bounty workflow:** [Owner-reviewed rewards and manual Base payments](docs/bounty-manual-flow.md). There are no campaign budgets or participant caps. The owner enters each reward at approval, pays externally and marks the withdrawal paid. Treasury keys and automatic payouts are not used. This guide supersedes the old treasury workflow below.

Express and MongoDB provide the existing Google, EVM wallet, Solana wallet and owner sign-in flows

Phase 2 adds authenticated Bounty & Earn APIs and a separate USDC ledger. See
[Bounty API, treasury setup and recovery guide](docs/bounty-phase-2.md) before enabling payouts.
MongoDB must be a replica set or sharded cluster for atomic bounty accounting.
The standalone admin page and real player integration are documented in
[Phase 3 entry points, deployment and verification](docs/bounty-phase-3.md).

The retired BaseDrop mining, BD tasks, payment checkout, treasure-card game, seasonal rewards and management APIs have been removed
RIVALS gameplay, missions, profile, rankings and store remain frontend features and are unchanged by this cleanup

## Live mission authority

Production assignments now require the live mission authority. The backend
builds the shared game rules with `npm run build:missions` (automatically before
start, dev and tests). Three.js renders the game and predicts movement; the
backend runs the existing movement, guard AI, weapons, projectiles, vehicles,
police pursuit and mission rules. Players send bounded inputs and interactions,
not health, hits, checkpoint snapshots or success claims.

Server damage reaching zero records a death and a two-hour recovery deadline
in one MongoDB transaction. The mission fails, its verified failure is saved,
and starting another mission remains blocked across devices until recovery.
Validated extraction records a verified result exactly once. First-completion
reward eligibility and replay status are recorded; Phase 4 still owns actual
XP/coin settlement. Browser cash/coins cannot revive a production operative or
change these server results. Bounty USDC accounting remains separate.

Server checkpoints contain health, ammo/loadout, enemy and pickup state,
objective progress and the exact simulation state. A reconnect within five
minutes restores the latest checkpoint; grenade deductions made since that
checkpoint remain spent. Recorded deaths cannot be restored or abandoned away.
Checkpoints are written at insertion/objective milestones, not every frame.

Authentication uses existing cookies/native sessions to mint a 30-second,
single-use Socket.IO connection ticket. Web and Capacitor clients connect
directly to the Render backend over WSS. Set `MISSION_SOCKET_ORIGIN` to the
public HTTPS backend origin if Render does not supply `RENDER_EXTERNAL_URL`.
Use one Render instance: ticket admission and simulation scheduling are local;
MongoDB ownership leases fence stale writers, but this is not a multi-instance
socket-routing implementation. An always-on service is required during play.

`MISSION_MAX_ACTIVE_SESSIONS` defaults to 4. Run `npm run benchmark:missions`
and real pursuit/network/database load tests on the deployment before raising
it. Inputs are bounded/rate-limited, owner snapshots are sent at 10 Hz, and no
rendering occurs on the backend. Performance on a development PC is not a
capacity guarantee for a Render plan. Detailed boundaries and test coverage:
[Mission authority integration](docs/mission-authority.md).

## Setup

Render should use Node 24 (pinned in `.node-version`), build command `npm ci`
and start command `npm start`. An explicit Render `NODE_VERSION` overrides
the version file: remove an old override or set it to `24.21.0`.

Startup connects to MongoDB first, explicitly creates registered collections
and required indexes, then initializes bounty accounting before listening.
Automatic model collection/index creation and database command buffering are
disabled. This avoids pre-connection initialization failures without weakening
the unique indexes protecting mission sessions and bounty accounting.
`test/startup.test.js` cold-starts the actual production entrypoint against an
isolated replica set, rather than only importing the Express application.

```bash
cd backend
npm ci
npm run dev
```

Keep the existing database and cookie configuration to preserve accounts and sessions
No database records or collections are deleted by this source-code cleanup
Legacy fields in the User schema and public account response remain for compatibility

## Configuration

Use the fully commented [Render environment template](.env.example). Preserve existing credentials; do not import placeholders. No new bounty environment variables or treasury credentials are required for manual withdrawals.

- `MONGODB_URI` — existing account database
- `JWT_SECRET` — at least 32 characters in production, no placeholder secret
- `SIWE_DOMAIN` and `SIWE_URI` — matching frontend host and origin
- `CORS_ORIGIN` — exact allowed frontend origins, comma separated, including `SIWE_URI`
- `PRIVY_APP_ID` and `PRIVY_APP_SECRET` — existing Google authentication credentials
- `COOKIE_SECURE=true` — required in production
- `COOKIE_SAMESITE=none` — needed for a genuinely cross-site frontend/API, otherwise prefer `lax`
- `COOKIE_DOMAIN` — optional, preserve the existing deployment value
- `CHAIN_ID` — default wallet challenge chain, still 4663 unless configured
- `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` — existing optional owner credentials
- `PORT` — defaults to 4000

Treasury wallets and payment RPC settings are not required for authentication or manual bounty withdrawals.
The production app never signs/sends payments, even if retired `BOUNTY_*` treasury settings remain configured.
Do not rename the database, session cookie or JWT issuer as part of this cleanup

## Retained endpoints

- `GET /ping`
- `GET /health` — MongoDB readiness, returns 503 while unavailable
- `GET /api/auth/nonce`
- `POST /api/auth/verify`
- `POST /api/auth/wallet`
- `POST /api/auth/google`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/admin/login`
- `GET /api/admin/me`
- `POST /api/admin/logout`

All retired API routes now return JSON 404 responses
Both middleware files, rate limits, origin checks, input scrubbing, token revocation, account status checks, login auditing and graceful shutdown are preserved
No mining or season background workers start with this service

## Verification

```bash
npm test
npm run smoke
npm run preflight:production
```

The smoke check validates syntax and imports without connecting to the database
Production preflight checks local deployment configuration without printing secrets or writing data
Database readiness and the reviewed legacy wallet-index migration remain available for authentication maintenance
