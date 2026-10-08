# Frontend deployment on Vercel

Use `robina` as the Vercel project's Root Directory when the repository root contains the `robina` and `backend` folders. Deploy the frontend separately from the backend.

The checked-in `vercel.json` selects Vite, installs with `npm ci --include=dev`, builds with `npm run build`, and serves `dist`. Including development dependencies supplies Vite and the other build tools even when `NODE_ENV=production` is set. The frontend uses Node.js 24.x. Commit both `package.json` and `package-lock.json` whenever dependencies change; use npm for this project.

In Vercel Project Settings > Environment Variables, set these public values for Production and any Preview deployments you use:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | The deployed backend's HTTPS API base URL, matching the application's local configuration |
| `VITE_PRIVY_APP_ID` | The public Privy app ID |
| `VITE_REOWN_PROJECT_ID` | The public Reown / WalletConnect project ID |

Local `.env` files are ignored by Git. Vercel needs its own environment settings. Redeploy after changing them because Vite embeds public configuration during the build. A `Production configuration is missing VITE_...` error identifies a missing deployment setting.

Keep `PRIVY_APP_SECRET`, JWT secrets, and database credentials on the backend host. Never prefix server secrets with `VITE_`.

Before deploying, run in this directory:

```sh
npm ci --include=dev
npm run dist-check
```

This starts from the committed dependency lockfile instead of reusing an older installed dependency tree. Do not use `--force` or `--legacy-peer-deps` to suppress installation conflicts.

Configure the deployed frontend origin in backend CORS, Privy, and Reown. After deployment, check login, wallet connection, API requests, and opening a game route directly.

References: [Vercel package manager selection](https://vercel.com/docs/package-managers), [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
