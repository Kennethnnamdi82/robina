# Cinematic gameplay upgrade

This upgrades the existing renderer/controllers; it does not replace the game,
mission authority, paid inventory, account system or HUD layout.

## Diagnoses and implementation

- **Crossed, extended arms:** the +Z-facing soldier's right shoulder is on local
  -X, but the weapon anchor and elbow hints used +X. `WeaponRig` now uses the
  correct shoulder side, a closer stock/grip position, and an under-foregrip
  support wrist. Actual finger bones and the existing animation layers remain.
  Extreme independent aim now turns only the visual stance beyond the chest's
  safe twist cone, preventing backwards arm folds. Normal aiming stays planted;
  planar side-view behaviour and authoritative movement are preserved.
- **First-person ADS drift/snapping:** the old view weapon switched position
  immediately and was then rotated toward the camera target again. The view
  weapon now damps hip/ADS placement, converges hip fire independently, and
  aligns ADS to the camera axis. The rifle has a physical open circular optic,
  housing, lens and red reticle. Pistol/SMG use their existing sight sockets.
- **FPS combined input:** first person replaces the aim/fire stick with an
  independently captured swipe area and SHOOT button. Other perspectives keep
  their existing sticks. SIGHTS toggles. Movement, looking and triggering can
  use separate pointers. A short trigger edge survives the 20Hz network sender;
  pausing clears pending input. Weapon-specific automatic/semi-auto behaviour
  is unchanged.
- **Camera framing:** the existing single `CameraRig` remains responsible for
  all four POVs, wall clearance and vehicle transitions. Third-person pitch is
  bounded and returns to a shallow follow angle when travelling after manual
  look expires. Aiming suppresses recentering. ADS FOV damps; entering vehicles
  clears ADS and restores the selected foot POV on exit.
- **Missing effects during live missions:** the trusted simulation now emits
  confirmed projectile impacts and grenade/vehicle detonations. These go only
  to the authenticated session's socket. Predicted client bullets cannot create
  live hit/blood rewards or damage. Body hits use directional pooled blood;
  walls/vehicles use non-blood impacts. Screen droplets are pointer-transparent,
  short-lived and restricted to received damage/nearby confirmed hits.
- **Client-only pedestrians:** `PedestrianSimulation` extracts the existing
  sidewalk/crossing/panic behaviour for server reuse. Movement runs at 15Hz,
  damage/grace periods at 60Hz. The existing instanced crowd interpolates server
  positions. Pedestrian health, pose, movement and grace state are checkpointed;
  legacy version-3 checkpoints remain readable. No per-pedestrian DB writes.
- **Weak explosions:** presentation radius is configured separately at 10m;
  grenade damage stays at the existing 7m/110-damage falloff and cover rules.
  Expanding fireballs, smoke, capped shockwaves, debris, persistent aftermath,
  scorch marks, distance-limited restored camera feedback and a cached blast
  sound replace the small flash. Vehicle blast propagation respects cover;
  the existing exploded/dead guards prevent repeated chain detonations.
- **Bore/cover consistency:** `WeaponGeometry` shares the actual prepared muzzle
  calibrations and grip with the server. The server computes its own bore and
  sweeps from the chest to the muzzle; it accepts no browser-supplied muzzle.
  Recoil/sway do not select targets or alter weapon stats.

## Resource ownership

`CinematicImpacts` caps fragments at 72, shockwaves at four, and blood stains at
eight. Existing smoke/flash/tracer/fire pools stay bounded. Optics and hands
dispose their own geometry/materials on equipment changes and shutdown. No
per-explosion point light is inserted into the city's shader pipeline.

## Verification entry points

- `npm test -- --maxWorkers 1`: application regressions, including new FPS
  pointer, ADS, effects, wall/vehicle-cover and trigger-transport tests.
- `npm run typecheck`, targeted ESLint and `npm run build`.
- `node scripts/verify-cinematic-gameplay.mjs`: actual supplied soldier/weapon
  GLBs, hand/socket errors and rendered landscape/portrait ADS. Images are
  written under ignored `test-results/cinematic`, not fabricated game captures.
- `node scripts/verify-store-fulfillment.mjs`: all nine owned outfit models
  using the real animator and weapon grip.
- Backend `npm test`: auth, payments, persisted mission/death/reward regressions.
- Backend `node --test test/cinematicMissions.test.js`: pedestrian checkpoint,
  real grenade fuse/damage radius, bounded vehicle chain reactions.
- Backend `node --test --test-name-pattern 'confirmed impacts' test/liveMissions.test.js`:
  authenticated WebSocket hit presentation with an isolated Mongo replica set.
- `npx playwright test --config playwright.rivals3d.config.ts cinematic.spec.ts`:
  real full-city touch controls, ADS and four POVs in both orientations.

## Honest verification boundary

Executed local checks:

- Frontend suite: **86 files / 555 tests passed**. The final focused pass also
  retained the original session/recovery tests alongside trigger, geometry,
  input, optic-cleanup, crowd-stride and animation regressions: **34 passed**.
- Existing complete backend suite: **140 passed**. After the final muzzle and
  pedestrian integration, the entire mission/database suite plus new cinematic
  simulation scenarios ran again: **14 passed**.
- TypeScript, production Vite build, targeted ESLint and scoped `git diff
  --check`: passed. Vite retains dependency annotation/large-chunk warnings.
- Actual purchased outfit animation/grip checks: **9 models passed**.
- Actual-model WebGL render: soldier, portrait/landscape ADS, grenade blast and
  lingering fire/smoke passed, without console shader errors.
- Existing rendered combat/animation/score Playwright test: **1 passed**.

The actual-model WebGL checks and rendered combat animation test ran successfully.
Full-city browser runs on this workstation stalled/time-limited during scene
loading or POV interaction, including at reduced presets and on a fresh,
isolated development server. A passing isolated
rig render is not proof of full-city mobile performance. Android hardware,
full-city simultaneous touch, and subjective visual approval still need device
verification. No new production deployment or mainnet payment is implied by this
local implementation report.
