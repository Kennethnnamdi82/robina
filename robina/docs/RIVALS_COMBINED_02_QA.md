# RIVALS combined prompt 2 — verification

> Historical phase snapshot. The current AI/security implementation and integrated verification are documented in [combined phase 3](RIVALS_COMBINED_03_QA.md).

Scope: original phases 5 + 6, world/environment and ranged combat. Creative context is `src/TASK/GAME_VISION.md`. Work remains inside the existing gaming experience; backend source, databases, balances, entitlements, transaction records and other site routes were not changed.

## Automated checks

| Check | Result |
| --- | --- |
| Frontend `npm test` | 72 passed, 22 files, 45.58 seconds on the final source |
| Backend existing `npm --prefix ../backend test` | 12 passed, 8.06 seconds; local test fixtures, no production database migration |
| `npm run typecheck` | Passed, application and Node configurations |
| `npm run lint` | Passed, zero errors; nine existing Fast Refresh warnings in shared UI/context files |
| Production `npm run build` | Passed, 10,273 modules, 2m47s, existing public `src/.env` recognized |
| Final minified QA build | Passed, 1,638 modules, 1m04s; standard large-chunk warning |
| Full minified browser regression suite | 19 passed; one 120-second test timeout during three repeated load/exit cycles; 24.4 minutes total. Focused final rerun pending. |

The first unit run had 70 passes and one timing assertion failure: the test checked empty-magazine automatic reload before the next fire interval. The assertion was corrected to include that interval; the complete 72-test suite passed twice afterward.

The production build retains third-party PURE annotation and large-chunk warnings. Its game adapter chunk is 41.34 kB (14.14 kB gzip), lazy Phaser engine 1,208.02 kB (332.17 kB gzip), and existing platform/wallet vendor chunk 7,175.53 kB (2,059.73 kB gzip). No production validation gate was disabled. `git diff --check` passed; backend source diff is empty and `src/.env` remains ignored.

The first world/browser run exposed a real long-frame input issue: Arcade accumulated enough simulation debt to move the player past an intended doorway in a single rendered frame. The scene now manually advances fixed 60 Hz physics with at most 100 ms of simulated time per rendered frame, discarding excess stall debt. The next new-scenario run passed all four scenarios in 6.2 minutes before the final floor-cache optimization and presentation cleanup. Final regressions below cover the finished build.

## Coverage

- Spawn safety, enclosed perimeter, connected navigable floor, body-width passages, routes to authored interaction ranges and correctly placed extraction.
- Range/line-of-sight guarded interactions; blocked prerequisites; door opening and occupied-door closing rejection; actual collision before opening and traversal afterward.
- Real sector authorization, vault opening, one-time core collection and conditional extraction. These are local training state transitions, not a claim of the later full mission/reward pipeline.
- Actual carbine projectile hits, target HP reduction/disable, hit feedback, magazine/reload, pause freezes, pool cleanup and restart resets.
- Return-fire projectiles cause actual player damage, death and restart recovery without a QA damage shortcut.
- Continuous collision does not tunnel past small targets at low simulation rates; nearer cover/doors block farther targets; open doors permit shots; same-team/owner targets are filtered; dead targets are excluded.
- Pool capacity, invalid input rejection, world/lifetime/range expiry and duplicate-impact prevention.
- Bounded damage, duplicate-event handling, finite grace windows, terminal death, no revival by med charge, early dodge immunity expiry, firing restrictions and unchanged dodge cooldown.
- Reload requests cannot restart a reload repeatedly; firing cannot bypass cooldown/reload/incompatible states. One test compares projectile outcomes at 15/30/60/120 updates per second. The Phaser integration uses fixed 60 Hz steps.
- Real three-contact touch movement/aim/fire, pointer cancellation, touch reload, portrait/landscape resize and existing mobile sprint/dodge/control-hiding behavior.
- Existing menu/briefing/settings persistence, all three operatives, animation transparency/directions, wall/cover collisions, camera clamping/tracking, pause/blur, repeated exits, audio disposal, quality/reduced motion and corrupt/missing asset recovery.

## Screenshots

Twenty-four captures from the full regression run were saved to `docs/rivals-combined02/`. Focused final combat captures refresh the weapon-alignment views. These are screenshots of the implemented canvas and UI; supplied concept references are not presented as gameplay.

- [Implemented menu](rivals-combined02/main-menu-desktop.png)
- [Briefing](rivals-combined02/briefing-desktop.png)
- [Playable arena](rivals-combined02/arena-desktop.png)
- [Desktop combat](rivals-combined02/combat-desktop.png)
- [Restricted vault/core](rivals-combined02/vault-access.png)
- [Training extraction](rivals-combined02/extraction-desktop.png)
- [Actual range damage](rivals-combined02/range-damage.png)
- [Touch portrait](rivals-combined02/combat-mobile-portrait.png)
- [Touch landscape](rivals-combined02/combat-mobile-landscape.png)

## Performance

Final measurements will be recorded in `docs/rivals-combined02/performance.json` using the local minified QA entry. The benchmark adds sustained firing, reload and bounded effect/pool activity to the prior three scenarios: desktop high/VEX, mobile balanced/NYX and mobile low/ROOK with 4× CPU throttling. This is Chrome emulation, not physical Android/iOS validation.

Changes reduce draw and update work through cached floor chunks, viewport culling, cached/merged projectile blockers, fixed-capacity projectile/impact pools, lazy optional sounds and throttled HUD updates. The floor cache costs approximately 9.63 MiB RGBA. The complete selected base/combat image + floor-cache estimate is 21,398,824 bytes (20.41 MiB), excluding effect textures, canvas render targets, image decoding copies and browser/native allocations. JS heap readings alone do not measure total memory.

## Limitations and next work

- This is an explorable combat-training slice. There are no enemy AI behaviors, advanced security puzzles, boss encounters, full timed Security Breach mission, mission result scoring or server-backed rewards/competition.
- Damage, equipment, core and extraction state are local to the run. Refresh resets the run. Browser validation is not multiplayer authority or anti-cheat.
- Operative action art remains incomplete: walking is authored; firing/hurt/reload/death need matching full-body cycles. Functional firing uses a separate low-detail supplied weapon attachment, recoil and effect layers. Door opening removes the supplied closed panel; no authored door-opening cycle was supplied.
- Floor caching trades roughly 9.63 MiB extra RGBA memory for fewer draw operations; its world-resolution composite may soften details at higher zoom. Final artwork, wall joins, repetition and attachment alignment still need visual polish toward the supplied target.
- Long frames are capped for input safety. Under severe stalls, local simulation time runs slower than wall time. Competitive timers/results must eventually use an appropriate validated time/command model.
- No deployment, external login/payment transaction, physical-device playtest, Safari/Firefox validation or extended thermal/load soak is claimed. No irreversible account or database operation was performed.

See `RIVALS_COMBINED_02.md` for architecture, controls, run commands, asset provenance and the next-phase handoff. Do not begin the next phase automatically.
