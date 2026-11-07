# Combat focus, locomotion and armory tuning

## Changed

- 3D incoming damage no longer disables aiming and firing for 220 ms, which used to turn the gun back toward travel during a firefight. Health loss, defeat, interaction locks, dodge/recovery locks and Classic hit-stun remain active
- Camera feedback has no yaw/roll oscillation, movement bob or firing FOV pulse. Optional pitch kick is capped at 0.0016 radians (0.092 degrees), or 0.00065 while aiming down sights. Gun recoil remains visible. The authoritative camera is restored before gameplay rays are sampled
- Authored locomotion now animates the spine and head instead of freezing the whole upper torso in a pistol pose. The arms retain their separate ready/reload/action tracks and two-handed weapon IK
- Walk/jog/run thresholds have hysteresis; speed fluctuations do not repeatedly restart crossfades. A small, damped turn bank supplements the existing phase-preserving stride transitions
- Incoming hits do not replace active aiming/firing or movement with the full-body stationary hit animation
- BLACKOUT is an original 128 BPM, eight-bar dark industrial score: sub-bass pedal, low strings, restrained minor-second tension and heavy percussion. Pursuit adds a rhythmically matched layer. Shot ducking preserves more musical intensity while leaving room for the weapon report
- Score generation is once per audio owner, not per frame, and adds no music downloads or dependencies. Existing mute, master/music volume, pause and disposal controls remain in charge

## Store boundary — important

Checkout is still disabled. There is no new payment provider, entitlement backend, fake receipt, local purchase flag or automatic free grant of paid items

The six premium firearm configurations now have higher per-hit damage, sustained firepower and effective range than every issued firearm. The store shows these actual definitions, separately from issued equipment, and Loadout supports applying a supplied owned configuration without accidentally reverting to the base weapon definition after switching or reloading

`Loadout.equipCollection` is only an integration hook. Its caller must supply confirmed ownership; it is **not** a purchase verifier. The current live hub supplies no ownership provider and does not invoke this hook. Prepared display models are not automatically substituted into the gameplay weapon rig

Buying and equipping uniforms is **not implemented**. The supplied military preview skeleton is different from the playable operative skeleton. It needs tested animation/hand-socket retargeting, as well as an ownership/equipment integration, before it can replace the player. The product dialog now states that the outfit is a studio preview rather than implying the player already wears it

## Verification

- Focused regression suite: 64 tests passed
- Application TypeScript check passed
- Tooling TypeScript and scoped ESLint checks passed
- Production Vite build passed when run on its own; the initial concurrent build was interrupted to relieve local memory pressure
- Main regression run: 375 tests passed in 57 files; the boss suite worker could not start under concurrent build/browser memory pressure. Its isolated retry passed all 7 tests (382 passing tests across the two runs, not a clean single full-suite invocation)
- Five Chrome checks passed: real operative/gun with repeated injuries and sprint/fire plus native offline soundtrack mixing/silence controls, responsive store navigation/payment preview, on-demand model preview cleanup, recovery preview, and real mobile multi-touch aiming/movement/camera/sprint/weapon switching
- Real-model check verifies grip/support alignment, torso animation, bounded camera angle, unchanged base aim/FOV and retained health loss
- Physical-phone performance and subjective AAA equivalence are not certified by browser emulation

Implementation checks were completed locally before release — the release commit and production status are tracked in GitHub and Vercel
