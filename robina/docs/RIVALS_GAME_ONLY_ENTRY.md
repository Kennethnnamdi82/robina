# RIVALS game-only entry

The public entry is now `/`: restore the existing session, show RIVALS login
if necessary, then mount the existing authenticated 3D game menu directly.
There is no mining homepage between authentication and the game.

The retired player routes (`/tasks`, `/rank`, `/auto-claim`, `/marketplace`,
`/profile`), old `/gaming` bookmarks and unknown player routes redirect to `/`
at the hosting layer and using client-side history replacement. Query settings remain intact, including the existing
explicit classic-game fallback. Referral links retain attribution without
rendering a separate page. The public snapshot banner and mining navigation
are no longer mounted.

`GameProvider` is no longer mounted by `App`. This removes its one-second
mining timer and background mining/leaderboard polling from the game-only app.
Neither the 3D runtime nor the classic fallback depends on that provider.
Accounts, backend records, wallet authentication and protected owner-only admin
tools are retained. Admin pages are lazy-loaded only when requested.

No 3D runtime, artwork, controls, gameplay, model assets or account balances
were changed for this request. Retired page source files are retained for
recovery, but they are not registered in the player router.

Verification:

- 29 focused unit/component checks pass, including 19 game-entry checks.
- App and Node TypeScript checks pass.
- Targeted lint has no errors (one existing GamingRoute fast-refresh warning).
- Production browser checks cover login recovery, direct home entry, retired
  page redirects, absence of mining polling, auth gates, classic fallback,
  actual 3D start/pause/exit and protected admin tools.
- All nine local production-browser checks passed. The first hosted login check
  passed, but the initial hosted cold 3D check hit its 180-second limit while
  downloading the city (before runtime creation). A hosted classic-link check
  also timed out waiting for the JavaScript redirect after a full reload. No
  page errors were reported. This is not a hosted cold-start performance pass.
  Hosting-level redirects were subsequently added for old public links so
  their canonical-URL redirect no longer depends on application transfer.

Publish through the existing `robina-mining` Vercel project, staging with
`--skip-domain` before promotion. The GitHub synchronization failure from the
earlier task is separate: pushing the earlier 3D commit alone would not include
this new routing change. Include `src/routes`, the updated `App.tsx`, login,
metadata and verification changes in any later GitHub synchronization.

## Live release

Published to `https://robina-mining.vercel.app` on 2026-11-04 after a protected
staging preflight. Deployment `dpl_JC9sCKCKUfyGuXjrLktvXVytQzjX`
(`robina-mining-f75f4ioo8-venomee.vercel.app`) is ready and promoted. Its entry
is `/assets/index-DBq_I2hu.js`.

Both protected staging and the public primary domain passed the HTTP preflight:
eight exact player-page redirects, including preservation of the classic
engine query, all fourteen gzip model redirects/headers/sizes, the RIVALS page
title and the RIVALS login entry module. This public check used no infrastructure
bypass credential. The earlier staged release `dpl_91mQCurwus4iB739zsBz2KUHZNv7`
was not promoted. The previously working 3D release
`dpl_EkafA5sy82V47eMKhnqPfnyMzBDU` remains the rollback reference.

The final release has no new hosted cold-start performance pass; the browser
download timeout above is retained as a verification limitation. Local real
3D start/pause/exit passed. No game assets, runtime or backend data were changed.
