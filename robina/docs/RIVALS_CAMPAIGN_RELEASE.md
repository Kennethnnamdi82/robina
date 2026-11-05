# RIVALS campaign implementation — 2026-11-05

## Scope and architecture

The existing Three.js runtime, character controller, weapons, projectile pool,
Health, tactical enemy AI, authored animation rig, four-camera rig, authentication
provider and backend contracts are retained. No dependencies, backend routes,
database schemas, payments or online leaderboard services are introduced.

New gameplay is adapted through `CampaignGameplay`, `PolicePursuit`,
`VehicleController`, `MissionNavigation`, `AssignmentSite` and immutable
`missions/assignments.ts` data. The original isolated development raid and explicit
classic fallback remain available; the public default stays the 3D command hub.

## Implemented behavior

- Seven assignments: bank, laboratory, corporate data, convoy, witness rescue,
  cargo delivery and military equipment recovery. Briefings show their real
  engine objectives. Security counts, tasks, response strength, physical mission
  sites, road closures, architecture density/heights and atmosphere vary.
- Local completion unlocks the next assignment. Direct links cannot bypass the
  frontend progression flow. Old three-operation dossier indices are preserved.
  Objective totals are recorded per run instead of assuming ten objectives.
- Success requires actual item/witness/loaded-vehicle recovery, breaking police
  contact and interaction at extraction. Guard kills alone cannot finish a run.
  Retry creates a clean runtime with the same assignment and seed.
- GPS uses the existing obstacle-aware navigation grid, with separate foot and
  vehicle clearance. Searches are throttled and camera-independent. The city
  minimap now uses the actual level dimensions instead of the old training-map
  viewport. Moving convoy destinations follow the real transport.
- Existing traffic and new parked vehicles are enterable. Occupied vehicles
  eject a civilian driver. Driving supports steering, throttle, brake, reverse,
  collision damage, separate mobile controls, exit clearance and switching cars.
  Chassis sweeps use oriented-rectangle collision checks; destroyed cars stop.
  Touch release/cancel and pause clear driving intent.
- Police repurpose real traffic cars, navigate toward the player, deploy bounded
  officers through the existing tactical NPC/combat adapter and continue pursuit
  while the player drives. Stolen police cars do not count as police tracking
  themselves. New crimes can restart a previously lost pursuit.
- Existing grenade damage/fuses are preserved. Blasts affect vehicles, generate
  pooled fire/smoke and prop impacts, leave a bounded scorch pool and visibly burn
  affected actors/critical vehicles. Critical vehicles burn down to disabled.
- A failed stolen-objective run drops the actual case; available responding
  police can approach and recover it during the bounded debrief presentation.
- Jump double-taps boost the existing controller's jump, with its normal
  gravity, swept horizontal collision, overhead collision and surface landing.
  A regression test lands on a stationary car-height surface.
- Mission loading is based on completed asset jobs, scene assembly, shader
  preparation and a complete first frame. Shared byte caching supports retries;
  there is no invented countdown or progress timer.
- Charcoal/white command UI, mission-board rows, restrained leaderboard tables,
  briefing/debrief language, login styling, settings and responsive landscape
  action groups replace the main dark/gold presentation. Existing original menu
  artwork is reused, not represented as a screenshot of gameplay.

## Authentication corrections

Google completion is single-flight and survives redirects. SDK readiness can
resume a pending callback. Epoch guards prevent a late startup 401 or stale
completion after sign-out from replacing newer auth state. Verification checks
the existing backend cookie before reporting an exchange-response failure.
The pending marker is not removed before verification finishes. Storage errors
cannot turn a successful exchange into a reported failure. Login no longer
forces navigation to `/`, preserving intended mission links.

Google verification allows a bounded 30-second first/cold-server request and
never retries POST writes. A non-secret prior-session hint gives returning users
a longer restore budget without accepting that hint as proof of authentication.
Tokens remain under the existing provider/backend security architecture.

## Mobile performance changes

High retains detailed colour geometry and normals while using cheaper building
shadow massing on touch devices, a 1024 shadow map, 30 Hz shadow refresh,
quarter-resolution bloom and no redundant mobile HDR MSAA resolve. Initial High
DPR is capped at 1.15 on touch devices; the existing hysteretic adaptive pixel
budget remains active. Lower settings, instancing, bounded pools, shared model
bytes and camera-stable geometry are retained. No phone FPS or RAM guarantee is
made from desktop browser emulation.

## Verification and limits

Release checks cover mission graph validity, reachable sites, explicit extraction,
failure/retry, real police dispatch adapters, vehicle entry/exit/collision/damage,
car-roof jumping, Google callback races and existing game behavior. Browser checks
use normal movement/driving input, mocked backend sessions and no account writes.
The multi-size HUD check includes 568×320, 667×375, 740×360, 812×375, 844×390,
896×414 and 390×844.

Important limits:

- Actual Android/iPhone hardware, Safari and live Google OAuth accounts are not
  available to this environment. Emulation is not a physical 4 GB phone benchmark.
- Cities are procedural variations using the existing three asset families and
  common arterial grid, with different access closures, parks, heights and sites;
  these are not seven separately authored AAA city asset packs.
- Driving uses bounded kinematic handling, not a new wheel/suspension physics
  engine. Door motion is a lightweight hinged presentation over supplied models;
  no new detailed vehicle interiors or deformation meshes are claimed.
- Evidence recovery depends on available responding officers and is capped to
  avoid an indefinitely active debrief renderer. It is not a scripted film.
- Progress, unlocks and personal rankings remain local to this browser. Online
  leaderboard fixtures stay explicitly fictional. No new store, purchases,
  currency economy or account inventory service is fabricated.

Final test results, Git commit and deployment verification are reported in the
release handoff; this document does not assert that unrun checks passed.

### Completed local verification

- 243 relevant regression tests across 41 files passed (single worker,
  15-second timeout for CPU-heavy DOM checks).
- A further 34 route/collision/operation checks passed after the final city
  layout variations were added.
- A final 25-check campaign run passed, including successful completion of
  all seven assignments through the gameplay interaction adapter, rejecting
  an uncommandeered convoy and handling co-located convoy/cargo interactions.
- Both application and tooling TypeScript checks passed.
- Production Vite build completed successfully.
- All 11 production-browser checks passed, including actual 3D startup,
  pause/settings/exit, mobile pages, login recovery, seven viewport layouts,
  walking to a real parked car, entering, accelerating, braking and exiting.
- A short-landscape specificity regression was caught and corrected; a first
  route run that overlapped a build was discarded and repeated successfully.
- Existing model assets and backend code remain unchanged.

Physical-device, real Google account and phone-FPS limitations above still apply.

### Hosted validation follow-up

The hosted preview exposed a parked-car/traffic spawn overlap that could trap a
car. Parking now uses clear curb positions and initial traffic conflicts are
resolved before the first scene is displayed. A 60-seed oriented-footprint
regression passes. Physical consoles use the same world blockers as movement;
the existing foot-navigation grid is refined for interior clearances. All seven
completion flows and interior routes pass after that change.

Hosted browser assertions use a 30-second cold-network budget instead of the
five-second local default. This changes test waiting only, not loading progress,
game simulation, performance targets or failure detection.
