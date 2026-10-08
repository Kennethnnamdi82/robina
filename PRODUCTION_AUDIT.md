# Production audit — 2026-10-09

Local verification passed, including the final packaged build. Deployment and live authentication/payment signoff are separate release gates. No deployment, database migration, payment, or currency grant was performed.

## Changes

- Application routes use eager imports; there is no React.lazy, Suspense loading boundary, or dynamic import in application source. The briefing appears immediately while graphics initialize. Wallet SDKs may still perform their own network requests during wallet interaction.
- API requests have an eight-second shared deadline, caller cancellation, and at most one short retry for transient reads. Writes are never automatically replayed. HTML and empty responses cannot pass as successful JSON APIs.
- Session restoration shares a four-second deadline across admin/user checks. Optional mining and leaderboard refreshes no longer hold profile loading or completed claims. Responses from an earlier session cannot repopulate a signed-out profile.
- Fixed wallet account fields, transaction byte types, admin API contracts, TypeScript targets, Tailwind configuration, and Buffer/global initialization.
- Removed the blocking Google Fonts stylesheet. System fonts render without an external font request.
- Cached libraries have separate build assets. Removed circular bundle dependencies. Production builds validate required public configuration, HTTPS API URLs, and accidental secret exposure through VITE_ variables.
- Vercel configuration caches hashed assets, revalidates index.html, and excludes API/assets from the SPA fallback.
- The game uses fixed 60 Hz simulation steps, bounded catch-up, merged actor geometry, four nearby district lights, pooled muzzle lighting/effects, cached audio buffers, reduced paused rendering, and adaptive pixel ratio.
- Graphics loss and render failures stop the operation safely and expose restart controls. Mouse capture has a three-second deadline. Missing audio does not prevent gameplay. Disposed starts and older audio unlocks cannot revive or suspend a newer operation.
- Backend readiness returns 503 while MongoDB is unavailable or shutdown is underway. Database buffering is disabled, queries and connection selection are bounded, and initial connection also has an overall deadline.
- Removed boot-time index deletion and the hardcoded deployment self-ping. Workers do not overlap and stop cleanly. SIGTERM/SIGINT drain requests and workers before disconnecting MongoDB. Removed a duplicate schema index declaration.

## Evidence

| Check | Result |
| --- | --- |
| Frontend clean npm installation | Passed in an isolated project, without force or legacy peer dependency flags; 0 known vulnerabilities |
| Clean-install production build and Chrome smoke checks | Passed; login recovery and game start/return both passed |
| Linux native packages and import filename casing | Required native packages are locked; 199 local imports checked |
| Frontend TypeScript, application and Node configs | Passed |
| ESLint | 0 errors; 9 existing development Fast Refresh warnings |
| Frontend unit/regression tests | 27 passed |
| Backend unit/readiness/worker tests | 12 passed |
| Game browser scenarios | 7 passed across full and focused runs |
| Production browser scenarios | 7 passed |
| Backend syntax and module-import smoke checks | Passed |
| Production environment preflight | Passed |
| Read-only live MongoDB check | Connected; unique wallet index exists; legacy walletAddress index absent |
| npm audit --omit=dev, frontend and backend | 0 known vulnerabilities |
| Final build and browser confirmation | Passed; packaged audio lifecycle verified; login/game smoke passed |

Production browser tests exercise expired sessions, stalled APIs, HTML API fallbacks, gameplay/return, admin access protection, all six user pages, and all seven admin pages under service errors. External authentication and payments are intercepted; the tests do not use live wallets or funds.

The game tests cover combat controls, all mission stages through actual raycast damage, sniper telegraphs, projectile/cover behavior, boss phases, extraction, graphics restart, disposal, fixed-step timing, and delayed audio resumes. The measured test scene has 22 player meshes, four active district lights, and 158 draw calls. This is a software WebGL check, not a hardware FPS certification.

The clean-install build entry is 215.65 kB (60.69 kB gzip). The shared platform SDK asset is 7,175.07 kB (2,059.51 kB gzip), and the Three.js asset is 537.99 kB (135.25 kB gzip). The build retains its large-chunk warning; that warning is not being hidden. No circular chunk warning remains.

## Repeatable release checks

From robina:

```sh
npm ci --include=dev
npm run verify:release
```

Start with a clean npm installation. The original audit used existing node_modules and missed React peer dependency conflicts during installation. The frontend now targets Node 24.x, removes unused React 19-only 3D dependencies and unused direct Stripe/mesh packages, supplies the testing library's DOM peer, and explicitly selects npm in Vercel configuration. Stale Bun lockfiles have been removed. The clean-install production build, TypeScript checks, lint, 27 unit tests, and two production browser smoke checks passed. See [Vercel deployment settings](robina/VERCEL_DEPLOYMENT.md).

The release command checks types, lint, unit tests, the production build, game/production browser tests, backend tests/imports, environment preflight, and production dependency audits. Browser tests use installed Windows Chrome; set PLAYWRIGHT_CHROME_PATH for another installation.

For the separate read-only database gate, from backend:

```sh
npm run readiness:production
```

A failed sandbox network check was rerun with network access and passed. The check reads connectivity and index metadata only.

The legacy index migration is available as a dry-run command for future databases. It is unnecessary for the database inspected here. Never run its --apply option without reviewing the dry run and backing up the database.

## Live release gates

1. Set NODE_ENV=production on the backend host, use npm start, and configure /health as its readiness endpoint. Confirm the deployed frontend/backend have the intended public IDs, frontend origins, secure cross-site cookies, and provider dashboard allowlists. The preflight validates local settings, not provider control panels.
2. Verify real Google OAuth, supported wallets, admin login, logout, and payment receipt/replay protection on the deployed origins. These require operator accounts and wallet approval; automated tests intentionally make no financial writes.
3. Confirm hosting remains awake and monitor readiness/error rates. Render free web services sleep after idle traffic and may take about a minute to wake; their own documentation excludes them from production use. [Render free service limitations](https://render.com/docs/free)
4. Profile the game on target GPUs and browsers, and measure first load over the target network. The eager wallet/auth library bundle remains large; cached assets improve repeat visits, but there is no universal zero-load-time guarantee.
5. RUGFIRE remains a desktop procedural combat vertical slice. Its XP/loot report is local presentation and an integration event, rather than a server currency award. Production art, recorded audio, multiplayer, and server reward persistence are outside this slice.

No tested uncaught browser error remains. This audit does not certify that every external service, device, network condition, or future change will be error-free.
