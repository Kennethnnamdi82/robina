# RIVALS 3D production integration — 2026-11-04

## Scope

Use the existing 3D game as the default at the authenticated `/gaming` route.
Do not replace the site's home page, authentication, backend, wallet, payment,
balance or admin features. Player assets, environment, vehicles, animations,
movement, weapons, camera tuning and damage rules are not redesigned in this release.

`GamingRoute.tsx` lazy-loads `RaidApp.tsx`, extracted from the existing sandbox
UI. The account-free test entry still requires DEV and its explicit sandbox flag.
The production entry does not use the test HTML or an authentication bypass.
Route departure releases WebGL/input/audio resources; effect replay in React
StrictMode does not prematurely destroy the running session.

Missions retain the existing in-memory practice semantics, with no account
reward writes. Graphics remain on the start/pause screens, not the gameplay HUD.
The classic game is retained at `/gaming?engine=2d` as a fallback. Setting
`VITE_RIVALS_ENGINE=2d` and redeploying restores classic as the default.

The release also reconciles stale weapon API/diagnostic references with the
existing supplied first-person view. No hands or replacement artwork are added.

## Packaging

The existing Vercel project is `venomee/robina-mining`, project ID
`prj_yVk3QG5Ot8tcZCbWeDnhLgmZvCEB`, with Root Directory `robina`.
Invoke Vercel from the monorepo root, one directory above the frontend.
Root and frontend `.vercelignore` exclude local environment files, raw art
downloads, converter inputs, backend source and local reports from CLI upload.
The production build copies runtime public assets but excludes `*-source.glb`.
The first release omitted gzip sidecars; a transport-only follow-up restores
the 14 verified sidecars and serves them with Content-Encoding: gzip through
explicit temporary redirects. Decoded GLB bytes and existing textures are retained.
Public asset URLs revalidate rather than keeping changed non-hashed artwork
immutable for a year. No production configuration validation is disabled.

## Verification before staging

- App and Node TypeScript checks: passed.
- Focused routing, camera, graphics, rendering and combat tests: 28 passed.
- Route and StrictMode resource-lifecycle checks: 6 passed.
- Full RIVALS unit suite: 179 passed, 1 pre-existing diagnostic assertion failed.
  `HumanoidAnimator.upperClipName` splits upper-layer action names on `:`,
  although those action names use an `upper-` prefix and no colon. The getter
  returns an empty string; the actual ready-pose selection/animation is present.
  This release leaves that animation implementation unchanged as requested.
- Production build: passed; existing third-party PURE/chunk-size warnings remain.
- Built production Chrome suite: **9 passed**. Covers failed/slow auth restoration,
  authenticated default 3D and classic fallback, login gates, actual low-preset
  world rendering, pause/settings/exit, zero API writes from the game, public
  authenticated pages and admin service-failure recovery.

Browser rendering used SwiftShader, not a physical phone. These tests do not
certify universal phone performance or live external-wallet/Google transactions.

## Deployment and rollback

Previous live production deployment (recorded before staging):

- ID: `dpl_5MHJuR1dECYcRZsNnHj9dwc36GY8`
- URL: `https://robina-mining-bnrl87kn3-venomee.vercel.app`
- Production domain: `https://robina-mining.vercel.app`

Stage using the existing production environment with
`vercel deploy --prod --skip-domain --yes --scope venomee`, then inspect the
result and promote only the verified deployment. Do not create a separate app
or change the project's Root Directory, domains, environment or auth settings.
If the promoted release is faulty, use Vercel's rollback to the deployment ID
above. No database migration is involved.

The release is built from the user's existing uncommitted 3D work. No unrelated
task-document changes are committed or pushed. A later Git-triggered deployment
must include the integration and prepared runtime assets to retain 3D.

## Staged release

- Deployment: `dpl_FLLnjCtrNbxorbSU8D2q1kJ3GDsw` (Vercel build READY).
- Deployment URL: `https://robina-mining-gu4zrv707-venomee.vercel.app`.
- Cloud-built entry: `/assets/index-Dk-KlkMi.js`; contains the lazy RaidApp chunk.
- Authenticated Vercel request to the city-block GLB: HTTP 206,
  `model/gltf-binary`, expected 4-byte range response.
- Staging is protected by Vercel authentication. The attempted remote browser
  run hit Vercel's login page and was stopped after three failed assertions;
  it is not recorded as an application test pass. Access settings were retained.
  Native `vercel curl` automatically provisioned a protection-bypass credential
  for the authenticated artifact check; no credential is copied into this report
  or source. Local Vercel state remains ignored by Git.
- Cloud installation reports 32 existing dependency audit advisories (12 moderate,
  20 high). No dependencies or lockfile were changed in this routing-only release;
  dependency remediation is separate from the user's unchanged-game request.

## Promotion

Vercel successfully promoted `dpl_FLLnjCtrNbxorbSU8D2q1kJ3GDsw` to the existing
production project. An unauthenticated request to
`https://robina-mining.vercel.app/gaming` returned HTTP 200 and the verified
`/assets/index-Dk-KlkMi.js` entry; authenticated Vercel inspection of the public
domain resolved to that same READY deployment. The site's application login gate
remains in place. No Git commit/push or backend deployment was performed.

Public HEAD requests also returned HTTP 200 with the expected binary/image types
for the operative GLB, optimized street car, delivery truck and asphalt texture.

## Live-network follow-up

The first public cold-start check reached the 3D screen but failed to reach
playing on this test connection (one run reached the error state, another stayed
loading until the test limit). A bounded city-file download received 100,391 bytes
in 15 seconds (about 6.7 KB/s). The original 7,107,608-byte city response was not
compressed. Do not describe this public cold-start check as passed.

Other public checks passed: three login-recovery cases, default 3D/classic
fallback navigation, login protection, deep admin gating and authenticated-page
recovery. The public seven-page admin sweep hit its five-minute network limit;
the same complete admin check passed locally. It is not a live admin pass.

The hosting-only follow-up includes 14 gzip files (7,629,837 bytes instead of
21,726,952 bytes). A regression checks every sidecar decompresses to exactly the
original GLB and asserts routing stays clear of API/asset paths. Both checks passed.
The build rejects stale gzip sidecars. Public model URLs redirect to `.glb.gz`
responses with explicit gzip encoding and glTF MIME type; the browser receives
the same decoded bytes. No artwork, animation, movement or camera tuning changes
are part of this follow-up.

An optional `PRODUCTION_TEST_WARM_ASSETS=1` test waits for the existing welcome
screen prefetch before entering, to separate renderer behavior from cold transfer.
It must not be counted as a cold-start or physical-device performance pass.

The follow-up cloud build is READY:
`dpl_9SaRXB6QQMbFQdNq7ikrqpCR4UU6`,
`https://robina-mining-ll7cffu43-venomee.vercel.app`.
Authenticated staged HEAD checks confirmed the original city-model URL gives
HTTP 307 to its gzip file, then HTTP 200 with `Content-Encoding: gzip`,
`Content-Type: model/gltf-binary`, and compressed Content-Length 1,385,743.
An isolated repeat transfer probe after competing checks stopped reached roughly
90.9 KB/s, still a constrained network; no universal fast-start claim is made.

Vercel successfully promoted the compressed-delivery follow-up to the existing
public domain. `node scripts/verify-production-delivery.mjs` then verified all
14 public redirects, gzip encodings, glTF MIME types, destination URLs and exact
compressed lengths (21,726,952 raw bytes / 7,629,837 transferred bytes).

The actual public warm-cache 3D smoke test then **passed** (52.3 seconds test
duration; 56.7 seconds runner duration). It used the real deployed model downloads
and renderer, reached playing, paused, kept Low settings accessible only in the
pause menu, exited cleanly, and observed zero game API writes or page errors.
This duration includes navigation, prefetch and rendering; it is not a measured
gameplay FPS or a universal startup promise.

The compressed-delivery cold check still exposed the existing runtime's 60-second
asset deadline (`Asset loading cancelled`) while real network transfers were
pending. A final production-launcher change now awaits the same shared welcome
prefetch before mounting RaidRuntime, rather than counting transfer time against
its unchanged model-preparation deadline. The local development sandbox's entry
behavior, all models, game rules, environment and controls remain unchanged.
The launcher displays download status and retains exit links while preparing.
Focused launcher/route/byte-identity regressions: **9 passed**; app TypeScript passed.

Final launcher build: `dpl_EkafA5sy82V47eMKhnqPfnyMzBDU`,
`https://robina-mining-28vq282l0-venomee.vercel.app` (READY).
`scripts/verify-staged-production.mjs` obtains an infrastructure-only Vercel
access cookie through the signed-in CLI and passes it to the browser test in
process memory/environment, never arguments or files. It does not bypass the
application's login; API responses remain isolated test fixtures. This allows
the real cold-start flow to be tested before promotion without making staging
public or disabling deployment protection.

The final protected staged **cold-start smoke test passed**: 1.2 minutes test
duration / 1.3 minutes runner duration on this constrained software-rendered test
host. There was no warm-cache flag or manually awaited prefetch in this run;
the actual production launcher handled preparation. It reached playing, rendered
the world, paused, retained Low settings in the pause menu, exited cleanly, and
reported no game API writes or page errors. This is functional verification,
not a claim of a seconds-fast first load or physical-phone frame rate.

Final promotion succeeded for `dpl_EkafA5sy82V47eMKhnqPfnyMzBDU`. After promotion,
the public-domain delivery verifier again passed for all 14 compressed models.
The intended game URL is `https://robina-mining.vercel.app/gaming` behind the
existing application login. GitHub remains unchanged; source edits/prepared
3D assets were still local/uncommitted at the end of that direct-deployment
phase and needed synchronization before a later Git-triggered deployment.

## GitHub synchronization follow-up

The user authorized committing and pushing this same release without redesigning
the website or 3D game. The existing project links to GitHub repository
`Kennethnnamdi82/robina`, production branch `main`, frontend Root Directory `robina`.

The release includes all 3D runtime code, shared adapters, prepared public assets,
lossless gzip sidecars, production routing, launcher and Vercel configuration.
Unrelated task-document edits, original converter downloads, local environment
files, Vercel credentials, browser reports and raw source masters stay out.
License notices are preserved verbatim, including upstream whitespace.

Before committing: 13 focused route/launcher/compression/camera tests passed;
app and Node TypeScript checks passed. The staged-content audit verified 105
binary assets byte-for-byte against the live-tested local files, found no
oversized GitHub files, excluded forbidden/private paths and found no
secret-looking values. No new gameplay, visual or control changes were made.
After pushing, verify Vercel's Git build resolves the production domain to the
new commit and repeat the compressed-delivery check.
