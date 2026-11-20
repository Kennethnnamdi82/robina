# Mission gameplay and completed-run verification

## Current web and Android clients

`LocalMission` runs the shared `MissionSimulation` at a fixed 60 Hz in the browser/WebView. Soldier movement, vehicle physics, AI, health, weapons, projectiles and objectives share this clock. The renderer follows local state. There is no gameplay socket, position reconciliation, heartbeat, health write, mission checkpoint or database call while an attempt is active.

One authenticated `POST /api/missions/permits` before insertion reads equipment and signs the mission ID, seed, initial inventory, simulation version and unique run ID. It creates no mission record. The permit lasts seven days. Gameplay continues through connection loss; ordinary pause and application backgrounding still pause the local clock. Closing an unfinished run discards it.

Input intent and discrete actions remain in memory during play. Only after success does the client gzip the recording into an account-scoped IndexedDB outbox, then upload 40,000-character chunks through the authenticated web relay or Android bridge. Requests fit the existing 64 KiB body limit. Failed and abandoned attempts create no mission or inventory writes.

## Verification and settlement

The backend authenticates the permit owner and signature, validates replay bounds, then replays inputs using the same mission/combat code in a worker thread. Success must satisfy the actual objectives, survival, handoff, location and police conditions. Client positions, health, damage counters and victory flags are never accepted as evidence. Input replay does not eliminate aim assistance or automation.

Only successful verification opens a database transaction. It creates one terminal MissionSession and VerifiedMissionResult and settles net grenade inventory changes using current inventory. Unique database keys protect run settlement and first-completion eligibility. Duplicate chunks, retries and concurrent deliveries cannot award the same run twice. A new successful attempt can rank but cannot repeat first-completion rewards.

Score weights and weapon/damage rules are unchanged. Replay results use score version 2 because duration counts active fixed simulation time instead of loading, menus or network outages. Historical live results retain version 1.

Pending completed runs survive reload and retry from the hub or completion screen. Verification failures never award rewards. Verified history restores successful mission history after a local-storage interruption. The completion screen distinguishes local victory from a verified save. Completed recordings can retry until their permit expires.

Performance points and the mission achievement appear immediately on success,
marked as awaiting confirmation. The browser and server share the score formula;
the server independently reconstructs its inputs through replay. Leaderboard and
season eligibility remain unconfirmed until settlement. Saving starts immediately,
retries brief connection failures after 1–5 seconds, and refreshes hub history on
confirmation instead of waiting for a periodic minute-long refresh. Device storage
denial does not block an online save; if both storage and network fail, the screen
explicitly asks the player to keep it open until the completed run is saved.

Replay limits: two hours at 60 Hz, 20,000 actions, 24 million base64 characters and 64 MiB decompressed JSON. One worker runs at a time with a 256 MiB heap limit and 120-second deadline. The queue allows eight active jobs, at most two per account, with 24 million buffered characters in total. Idle partial uploads expire after two minutes. Rejected proofs cannot fill active queue slots. Uploads have per-account rate limits. Upload/verification jobs are memory-only; a backend restart causes the durable client outbox to resend.

## Rendering and touch controls

Projectile collision/damage rules run once. The renderer observes swept segments for tracers and presents hit/muzzle/audio events without a second projectile simulation. Shadows retain the graphics-budget cadence instead of rerendering with every HUD notification. View projection matrices update only when aspect or FOV changes.

Dragging the captured fire finger turns the FPS/TPS camera while the other finger moves. Pointer ownership, cancellation, capture loss, backgrounding and blur release controls. Camera input updates refs and the rig directly, without React state updates per pointer movement. Movement pauses during handoff/pickup menus while their choices remain usable.

## Installed-client compatibility and deployment

Legacy `/sessions` and Socket.IO remain available for previously installed APKs. Those clients still use live simulation, checkpoints, health events and the five-minute reconnect window. New clients never open those sessions. Death cooldown and new paid recovery purchases remain retired. Historical sessions, receipts and entitlements are retained.

Deploy both backend and frontend, with the backend first. Backend prestart bundles shared source from the sibling frontend directory. A new signed APK is required: Vercel cannot update bundled Android JavaScript or bridge policy. Existing single-instance Render configuration is supported. Multiple verification instances can settle idempotently, but chunk routing requires sticky sessions or a shared upload queue.

Replay format version 1 supports simulation versions 3 and 4. Updated clients request version 4 for the movement collision changes. Older clients still get version 3, and recordings are verified against the version on their signed permit. The installed live protocol remains on version 3.

## Verification

`missionCompletions.test.js` uses an isolated MongoDB replica set and an actual successful recorded mission played with ordinary controls, combat and extraction. Tests reject unfinished/forged runs, verify exact final health, prove no in-play writes, and check idempotent settlement and first-completion rewards. Regenerate the fixture with `node scripts/record-replay-fixture.mjs` after `npm run build:missions` when intentionally changing compatible rules.

`localMission.test.ts` compares browser simulation with an independent replay and checks connection gaps, pause and recording bounds. Completion tests cover gzip, retry durability and request sizes. Touch tests cover simultaneous movement/fire/look and pointer interruptions. Legacy live tests continue protecting older installed clients.

Run `npm test` in `backend`. In `robina`, run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. `npm run test:e2e:missions` exercises React/Three.js offline and completion retry against an isolated backend. Its `/__test/*` endpoints never exist in production. Use `RIVALS_SOFTWARE_RENDERER=1` for CPU-only development Chrome.

These checks do not replace physical-phone profiling or human playthroughs of every mission. Local ownership removes network pullback; GPU cost, thermal throttling and long browser frames still require device-specific measurement.
