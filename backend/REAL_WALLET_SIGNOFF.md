# Real Wallet Signoff

This script performs live signoff using a real Base wallet and real USDC transfers.

It validates:
- SIWE sign-in (`/api/auth/nonce`, `/api/auth/verify`, `/api/auth/me`)
- Payment success path (`/api/payments/quote`, on-chain USDC transfer, `/api/payments/verify`)
- Game success path (`/api/game/start`, on-chain USDC transfer, `/api/game/reveal`)
- Final user state + leaderboard

## Cost Warning

This will spend real USDC and gas on Base.

Default spend:
- `instant_claim` (amount from backend quote, usually small)
- `game_reveal` (0.1 USDC by default backend config)

Optional spend:
- `auto_claim` (`--include-auto-claim`)
- `upgrade` (`--include-upgrade`)

## Requirements

- Wallet private key with:
  - enough ETH on Base for gas
  - enough USDC on Base
- Backend running and reachable
- Correct SIWE values expected by backend (`SIWE_DOMAIN`, `SIWE_URI`)

## Run

```bash
cd backend
npm run verify:wallet -- \
  --api-url http://localhost:4000 \
  --private-key 0xYOUR_PRIVATE_KEY \
  --siwe-domain localhost:8080 \
  --siwe-uri http://localhost:8080
```

Optional flags:

```bash
--include-auto-claim
--include-upgrade
--card-index 0
--rpc-url https://mainnet.base.org
```

## Output

The script prints a JSON summary:
- `passed: true|false`
- per-step checks with tx hashes and API results

File:
- `backend/scripts/real-wallet-signoff.mjs`
