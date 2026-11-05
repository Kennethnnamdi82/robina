# Gameplay repair — 5 November 2026

## Behaviour

- Touch aiming changes the gun/reticle and the authoritative projectile ray, not camera yaw or player translation. The touch character faces actual movement; an idle POV change cannot initiate a delayed feet turn. Upper-body aim remains independent.
- The driving joystick steers. Separate held accelerator, reverse and brake pedals own their respective input axes; releasing steering does not cancel a held pedal.
- Entering the reserve bank raises the alarm. Its visible, handled briefcase can be collected within actual interaction range/line of sight without a mandatory guard wipe or terminal minigame. Escape and extraction remain required.
- Responding police use actual city cars, street navigation and safe officer exits. Inbound travel does not immediately count as evading pursuit. Responding officers have a faster, longer-range combat profile and still require line of sight.
- Civilians use the existing swept bullet and damage system, react to hits, stop walking on lethal damage and play the supplied Death01 animation. This is nongraphic; civilians do not become guard kill rewards.
- Nearby grenade blasts ignite vehicles and building/cover surfaces. Vehicle fire damages the vehicle over time. Bounded flame/smoke instances persist after the initial explosion; buildings do not structurally collapse or change their navigation geometry.

## Rendering and simulation budget

- Touch-device High keeps detailed assets/materials but uses a native scene pass instead of the HDR/multi-pass bloom composer.
- Mobile foliage uses trunk shadows and existing ground contacts instead of rendering alpha-card canopies into the shadow map.
- Cache static pedestrian blockers/architecture fingerprints, throttle night-lamp selection, avoid redundant cover path searches, and reduce distant idle AI decisions.
- No new dependency, backend, account write, payment change, or production graphics UI was introduced.

## Verification

- RIVALS automated suite: 243 tests across 39 files passed; focused repair/animation/touch tests passed again after the touch-facing correction.
- Application and build-tool TypeScript checks passed; production Vite build passed (existing shared-platform chunk-size and Privy annotation warnings remain).
- Isolated real Chrome/WebGL visual fixture verifies the supplied civilian terminal fall plus persistent surface fire, with no shader errors. Generated screenshots stay under ignored test-results, not the user's existing art reports.
- Production browser regressions cover all three pedals, seven mobile HUD dimensions, actual CDP right-stick touches and changing bullet direction, High graphics and physical movement into the bank followed by Collect. These tests use intercepted authentication and do not mutate a real account or backend.

Desktop Chrome/device emulation is not a physical-phone FPS certification. No universal 60 FPS, instant cold network load, AAA asset replacement, structural building destruction or zero-defect guarantee is claimed.
