# BaseDrop Backend

Express + MongoDB backend for BaseDrop, enforced for Robinhood Chain mainnet (`chainId=4663`) with on-chain USDC verification.

## Setup
```bash
cd backend
# Configure environment variables (at minimum:
# MONGODB_URI, JWT_SECRET, TREASURY_WALLET, ROBINHOOD_RPC_URL,
# ROBINHOOD_USDC_CONTRACT, SIWE_DOMAIN, SIWE_URI, CORS_ORIGIN,
# and CHAIN_ID=4663).
npm install
npm run dev
```

Health check:
- `GET /health` -> `{ ok: true, chainId: 4663 }`

## Environment Variables
- `TREASURY_WALLET`: wallet that receives user USDC payments.
- `ADMIN_LOGIN_WALLET`: optional wallet allowed for wallet-based admin access.
- `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`: credentials for `/api/admin/login`.
- `JWT_SECRET`: session signing secret (must be strong).
- `SIWE_DOMAIN` + `SIWE_URI`: expected SIWE origin values. Set these to the production frontend host/origin (for example, `your-app.vercel.app` and `https://your-app.vercel.app`).
- `CORS_ORIGIN`: comma-separated exact frontend origins, including the production `SIWE_URI`.
- `ROBINHOOD_RPC_URL`: Robinhood Chain mainnet RPC endpoint. Robinhood's public RPC is rate-limited; use a dedicated provider in production.
- `CHAIN_ID`: must be `4663` (Robinhood Chain mainnet).
- `ROBINHOOD_USDC_CONTRACT`: USDC contract address on Robinhood Chain (defaults to `0x80e0e24718dbfcad49ecaa6f1e6c89a190586ca8`). The frontend's `VITE_ROBINHOOD_USDC_ADDRESS` should match it.

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
