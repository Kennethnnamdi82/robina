# Manual four-POV camera and locomotion stability

## Behaviour

All four existing views remain: tactical, side, third person and first person.
Movement never rotates the camera. No idle recenter timer, speed-driven FOV/boom
change, pitch recenter, velocity look-ahead, or reversing camera flip remains.
Players rotate TPS/FPS with the existing playfield swipe/right mouse drag.
Movement and driving use that same current camera yaw. ADS, zoom preferences,
collision-safe camera booms and vehicle/POV transitions remain available.
Explicit aiming/manual look takes priority even during a view transition.

The camera translates with the character's interpolated render position. Only
boom/zoom/transition changes are damped; walking is not smoothed a second time.
Server reconciliation still uses a presentation-only correction offset. It does
not grant the client authority over health, position, death, cooldowns or rewards.

## Workload changes

- Walking collision queries now use the same two-metre broad phase as the
  server, with a reusable buffer, before running the existing swept solver.
  Nearby people, vehicles, doors and walls still collide.
- Remote snapshots are committed once at the start of a rendered frame before
  fixed-step prediction. Regular snapshot receipt no longer duplicates the
  10Hz HUD/diagnostics publication. Terminal/death updates are immediate.
- NPCs share one reusable player target vector rather than allocating it for
  every character every draw.
- Dynamic resolution responds to sustained frame rates below 50FPS, rather than
  waiting for rates below 35FPS. This is a workload target, not a device FPS guarantee.
- During sustained overload, optional high-preset AO/bloom yield to a single
  world pass and shadow updates are capped at 12Hz. The models, city, materials,
  lighting setup, AI, damage and movement speeds are not replaced. Hysteresis
  restores the optional effects after recovery without toggling every frame.

## Verification

`MovementStability.test.ts` covers all POVs, variable render intervals, sprinting
under repeated nonlethal damage at 15/30/60/120Hz, combat release, manual look
during transitions, and collision-query equivalence. Existing camera/vehicle,
frame-surface, damage, world-physics and mission-client regressions also apply.

`node scripts/verify-smart-camera.mjs --low --mobile` exercises actual WebGL,
touch look, all four POVs and vehicle/reverse/exit behaviour against the isolated
local realism fixture. Set `RIVALS_CAMERA_TEST_ORIGIN` to another loopback port
if needed. Results go to ignored `test-results/manual-camera`, never into user
artwork. It is an offline presentation test, not a real phone/network benchmark.

Network outages and very slow devices can still interrupt gameplay. No local
test can establish a universal no-lag guarantee; physical-device validation is
required before making that claim.
