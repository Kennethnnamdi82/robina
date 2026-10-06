# BaseDrop Backend

Express + MongoDB backend for Robina. Cookie-based wallet sessions and USDC checkout support Robinhood Chain (`4663`), Base (`8453`), and Solana mainnet (Phantom/SPL USDC), with independent on-chain verification.

## Setup
```bash
cd backend
# Configure environment variables (at minimum:
# MONGODB_URI, JWT_SECRET, TREASURY_WALLET, SOLANA_TREASURY_WALLET,
# ROBINHOOD_RPC_URL, ROBINHOOD_USDC_CONTRACT, BASE_RPC_URL,
# BASE_USDC_CONTRACT, SOLANA_RPC_URL, SIWE_DOMAIN, SIWE_URI,
# CORS_ORIGIN, and CHAIN_ID=4663).
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
- `BASE_RPC_URL`: Base mainnet RPC endpoint; use a dedicated provider for production traffic.
- `BASE_USDC_CONTRACT`: USDC contract address on Base. The current template uses the canonical Base USDC address; verify it against official Base/Circle documentation before production.
- `SOLANA_RPC_URL`: Solana mainnet RPC endpoint. Obtain a dedicated endpoint from a Solana RPC provider (for example, Helius or QuickNode); the public endpoint is rate-limited and is not recommended for production payments.
- `SOLANA_TREASURY_WALLET`: Solana public key receiving SPL USDC payments. This must be a treasury-controlled wallet and is required in production.
- `SOLANA_USDC_MINT`: Solana mainnet USDC mint. The template defaults to the canonical Circle mint; verify it with Circle/Solana documentation before deployment.
- `COOKIE_SECURE=true`: required in production. Use HTTPS for the frontend and API. For genuinely cross-site deployment, configure `COOKIE_SAMESITE=none`; otherwise prefer `lax`.
- `EVM_RPC_URLS`: optional comma-separated overrides in `chainId=https://rpc-url` form for additional configured EVM RPCs. A chain must also be explicitly configured in backend code before it can be accepted for payments.
- `CHAIN_ID`: must be `4663` (Robinhood Chain mainnet).
- `ROBINHOOD_USDC_CONTRACT`: USDC contract address on Robinhood Chain (defaults to `0x80e0e24718dbfcad49ecaa6f1e6c89a190586ca8`). The frontend's `VITE_ROBINHOOD_USDC_ADDRESS` should match it.

Frontend-only Solana RPC setting:
- `VITE_SOLANA_RPC_URL`: Solana mainnet endpoint used by the wallet to submit and confirm SPL USDC transfers. Configure a provider endpoint as well as `SOLANA_RPC_URL`; the frontend value is public and must not contain a private credential.

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
- Signed HttpOnly, Secure-in-production cookies for user/admin sessions; unsafe API requests are restricted to configured origins.
- SIWE nonce, chain, domain, URI, and staleness validation.
- Server-authoritative economy and payment verification.
- Shared chain/transaction claims and unique transaction indexes prevent replay across checkout, legacy payment, and game payment paths. Existing MongoDB deployments must inspect and migrate old payment indexes before deploying the new compound intent index. In particular, remove the old global `transactionHash_1` unique index only after confirming no conflicting data and scheduling the migration.
- Never use real mainnet wallets or funds in automated tests; use mocked RPC/verification or a dedicated test environment.
