# Smart cinematic camera

The existing `CameraRig` and its four POV buttons are retained. No controller,
weapon, vehicle physics, enemy AI, mission, economy or UI-layout rewrite.

- Third person follows world-space travel with exponential damping and a
  bounded shortest-arc turn. Sprint framing widens gently; releasing movement
  lets the camera settle. A continuous stick/key gesture retains its movement
  basis during automatic recentering, preventing a camera/steering feedback loop.
- Playfield orbit takes priority for 2.2 seconds after the last manual input.
  Explicit aiming, firing, reloading and equipment actions hold automatic yaw,
  with a short combat-release grace period. A lagged shoulder never steers the
  aim ray sideways; existing hit tests and recoil remain unchanged.
- Occupied vehicles use speed- and length-aware chase framing, with delayed,
  hysteretic reverse visibility. First person temporarily uses an exterior
  chase view while driving, then restores the selected first-person POV and
  its zoom on exit. Tactical and side perspectives retain their fixed axes.
- Mode transitions blend camera pose, orientation and matched framing. First
  person keeps responsive head-level tracking. Side-view zoom and independent
  per-mode preferences remain available. Reduced-motion preferences skip
  cinematic pose/zoom blending.
- `CameraObstruction` tests padded existing solid boxes, including oriented
  obstacles, skips only the occupied car, retracts immediately and recovers
  gradually. It checks the damped eye too, not just the destination. It never
  moves/fades buildings or raycasts detailed render meshes. Work vectors and
  runtime motion context are reused.
- Local driving prediction and authenticated server input receive the same
  stable camera-input basis. This does not grant client authority over movement,
  health, death, rewards or results.

## Verification

`SmartCamera.test.ts` covers following, 180-degree turns, variable frame rates,
manual/combat priority, stable strafing aim, reverse/braking, steering feedback,
four POVs, zoom preservation, vehicle exit and collision recovery. Existing
controls, scene presentation and recoil tests remain applicable.

Run from the frontend directory:

```sh
npm run typecheck
npm exec -- vitest run --maxWorkers=1
npm run build
node scripts/dev-rivals3d.mjs --host 127.0.0.1 --port 8084
node scripts/verify-smart-camera.mjs
node scripts/verify-smart-camera.mjs --mobile
```

The browser audit uses the actual `RaidRuntime` through a DEV-only graphics
fixture, not a replacement scene or production authorization bypass. Reports
and screenshots go to `docs/rivals-3d/smart-camera/`. Mobile viewport/touch
emulation does not establish physical Android device performance. Play-test
swipes, simultaneous aim/movement, tight interiors and long pursuits on a phone
before treating device-specific camera feel/performance as verified.
