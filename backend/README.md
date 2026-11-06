# RIVALS authentication backend

Express and MongoDB provide the existing Google, EVM wallet, Solana wallet and owner sign-in flows

The retired BaseDrop mining, BD tasks, payment checkout, treasure-card game, seasonal rewards and management APIs have been removed
RIVALS gameplay, missions, profile, rankings and store remain frontend features and are unchanged by this cleanup

## Setup

```bash
cd backend
npm ci
npm run dev
```

Keep the existing database and cookie configuration to preserve accounts and sessions
No database records or collections are deleted by this source-code cleanup
Legacy fields in the User schema and public account response remain for compatibility

## Configuration

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

Treasury wallets, token addresses and payment RPC settings are no longer required
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
