# RIVALS combined prompt 4 — QA and evidence

Verification date: 2026-10-30. Scope: original phases 9 + 10, the existing Gaming page and isolated QA harness. These results describe a local single-player practice vertical slice, not authoritative rewards or a finished commercial release.

## Checks

| Check | Result |
| --- | --- |
| Frontend unit tests | **110 passed**, 26 files, 33.23 s |
| Application + Node TypeScript | **Passed** |
| ESLint | **0 errors**, 9 existing shared UI/context Fast Refresh warnings |
| Final isolated minified preview | **Passed**, 37.03 s |
| Final full Chrome regression | Verification in progress |
| Existing backend tests | Verification in progress |
| Production build | Verification in progress |

The unit suite covers the mission graph, invalid transitions, first terminal result, early extraction, objective evidence/prerequisites, optional XP, mission unlock prerequisites, mission/objective timer expiration and pause, separate practice storage, duplicate receipts, best times, storage failures and physical vault/gate locks. Boss coverage includes activation, reduced motion/skip, A/B/C thresholds, transition armor, charge armor, every attack, fixed pulse targeting, recovery, stagger cooldown, cover navigation, death-once and fresh-instance reset.

Timer expiration and configurable objective deadlines are tested deterministically in the pure mission engine. Browser coverage selects the real eight-minute challenge and checks pause/resume; it does not claim to wait eight real minutes for that countdown. Standard insertion is explicitly untimed.

## Browser acceptance and corrections

The full regression contains 26 cases: the previous movement, combat, AI, security, assets, audio, settings and cleanup cases plus early extraction, optional challenge/failure, and the mobile Guardian encounter. The expanded full heist uses genuine input through the compound, hack failure/retry, phase pads, guards, relays, boss phases/attacks, vault, core, extraction/results, replay and persistence across reload. No teleport, health boost, forced boss phase, objective grants or forged success are used in the full playthrough.

The isolated validation-only adapter is used in the separate deterministic player-defeat/control-focus case. The mobile Guardian failure case uses real Guardian projectiles. It checks touch dodge/fire, portrait/landscape health UI, skip, pause clock/boss freeze, defeat results and reset to a dormant 450-HP boss with an empty projectile pool.

Issues found and resolved during this phase:

- Relay UI was stale while the reveal froze ordinary field publication. The scene now publishes the final relay/objective state before freezing it.
- A nearby cover obstacle could leave the boss waiting instead of routing around it. Its cached navigation now also runs when line of sight is blocked at close range.
- The sector gate now reports Guardian lockdown and rejects toggling while its encounter barrier is active. Normal interaction returns after defeat.
- Valid final extraction now finishes atomically and captures current combat counters before stopping simulation.
- Test traversal approached relay B at the edge of its actual 100-pixel range; it now approaches within range with explicit tolerance. Touch firing is tested after dodge recovery rather than during the intentional attack lock.
- The desktop test originally tried to click the transient skip button after taking a screenshot; the reveal ended and the button disappeared. That wait was stopped, scoped test processes were cleaned up, and desktop now lets the reveal end naturally. The touch case verifies skip. Actions now have a 15-second timeout to avoid long waits for vanished controls.

## Performance

Final measurements pending. The benchmark script supports `--combined04` and writes this phase's results separately without overwriting earlier phase evidence. Its four existing scenarios sample an active guard/security area with sustained fire. Guardian phase measurements are captured separately during the real full heist. All renderer, CPU-throttle and viewport details must be read with the measurements; mobile emulation is not a physical device test.

## Screenshots

Actual implemented-game screenshots are saved under `rivals-combined04/`. These are not concept/reference art presented as gameplay. Links will be finalized after the full regression.

## Remaining limits

- The Guardian reuses the supplied ROOK atlas, carbine/impact assets and procedural telegraphs/collapse. Dedicated boss armor/silhouette, authored attack/hurt/death animations and boss-specific audio remain needed.
- Local practice XP and clearance records are untrusted browser data. No economic reward, ranked score, inventory, account XP or legacy balance is awarded. No RIVALS validation backend is claimed; the retired card-game backend is preserved.
- The existing field clock slows under severe stalls because the simulation bounds catch-up work. It cannot be used as a trusted competitive clock.
- Physical Android/iOS, Safari/Firefox, thermal soak, deployment and authenticated production end-to-end sessions are untested here. Final target-art parity and production readiness are not claimed.

Architecture, controls, local run commands and the next-phase handoff are in [the implementation report](RIVALS_COMBINED_04.md).
