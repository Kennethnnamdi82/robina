# BaseDrop Backend

Express + MongoDB backend for BaseDrop, enforced for Base Mainnet (`chainId=8453`) with on-chain USDC verification.

## Setup
```bash
cd backend
cp .env.example .env
# edit .env (at minimum: MONGODB_URI, JWT_SECRET, TREASURY_WALLET)
npm install
npm run dev
```

Health check:
- `GET /health` -> `{ ok: true, chainId: 8453 }`

## Environment Variables
- `TREASURY_WALLET`: wallet that receives user USDC payments.
- `ADMIN_LOGIN_WALLET`: optional wallet allowed for wallet-based admin access.
- `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`: credentials for `/api/admin/login`.
- `JWT_SECRET`: session signing secret (must be strong).
- `SIWE_DOMAIN` + `SIWE_URI`: expected SIWE origin values.

Legacy aliases still supported:
- `ADMIN_WALLET` (alias of `TREASURY_WALLET`)
- `ADMIN_AUTH_WALLET` (alias of `ADMIN_LOGIN_WALLET`)

## API Surface

### Auth
- `GET /api/auth/nonce?wallet=0x...`
- `POST /api/auth/verify`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Mining
- `GET /api/mining/status`
- `POST /api/mining/claim`

### Payments
- `GET /api/payments/quote?action=upgrade|instant_claim|auto_claim`
- `POST /api/payments/verify`
- `POST /api/payments/upgrade-bd`

### Tasks
- `GET /api/tasks/catalogue`
- `GET /api/tasks/mine`
- `POST /api/tasks/submit`
- `POST /api/tasks/daily`

### Game
- `POST /api/game/start`
- `GET /api/game/state`
- `POST /api/game/reveal`
- `POST /api/game/reset`

### Leaderboard
- `GET /api/leaderboard`

### Admin
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/users`
- `GET /api/admin/payments`
- `GET /api/admin/tasks`
- `POST /api/admin/tasks/review`
- `GET /api/admin/seasons`
- `POST /api/admin/seasons/start`
- `POST /api/admin/seasons/end-current`
- `GET /api/admin/leaderboard`
- `GET /api/admin/analytics`

## Security Notes
- Helmet enabled.
- CORS allow-list + credentials.
- Global + endpoint-specific rate limits.
- Signed HttpOnly cookies for user/admin sessions.
- SIWE nonce, chain, domain, URI, and staleness validation.
- Server-authoritative economy and payment verification.
- `Payment.txHash` uniqueness prevents replay.
