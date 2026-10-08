# Robina Frontend

## Run
```bash
cd robina
npm ci --include=dev
npm run dev
```

Use Node.js 24.x. Set the public `VITE_API_URL`, `VITE_PRIVY_APP_ID`, and `VITE_REOWN_PROJECT_ID` values in `.env`. The API URL must point to the deployed HTTPS backend for production builds.

For Vercel, follow [the deployment guide](VERCEL_DEPLOYMENT.md); local `.env` settings do not automatically transfer to the host.

## Build
```bash
npm run build
npm run preview
```

## Source Layout
- `src/components`
- `src/pages`
- `src/hooks`
- `src/services`
- `src/utils`
- `src/assets`
