# RIVALS — Combined prompt 4 / original phases 9 + 10

This phase connects the existing Neon District mechanics into **THE LAUNCH**, a replayable single-player practice heist with a three-phase Vault Guardian. The creative context in this checkout is `src/TASK/GAME_VISION.md`; no `GAME_CONTEXT.md` was found. The attached combined prompt is the implementation scope. No next-phase features are included.

## Play locally

From `C:\Users\kenne\Documents\RIVALS\robina\robina`:

```powershell
npm.cmd run dev
# Existing website, authenticated /gaming route.

npm.cmd run dev:rivals
# Isolated local QA: http://127.0.0.1:8082/tests/rivals/index.html

npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e:rivals
npm.cmd run build
npm.cmd --prefix ../backend test
```

The existing public configuration in `src/.env` remains recognized and ignored by Git. No new services, packages, payment dependencies or database setup are needed for this practice mission. The isolated QA entry is not the production authentication route. `?validation=1` exposes existing damage/AI diagnostics only in that entry.

Choose PLAY → THE LAUNCH → operative → START MISSION. Standard insertion has **no deadline**. The optional **8-minute timed challenge** is explicitly selected in the briefing. WASD/arrows move, Shift sprints, Space dodges, mouse aims/click fires, R reloads, E interacts, Escape pauses. Touch uses the left movement stick and right aim/fire/dodge controls.

## Implemented loop

1. Enter the compound through the operable transit shutter. The insertion uplink is optional recon.
2. Hack sector access. The existing isolated hacking UI freezes field time, patrols, shots and security.
3. Link WEST → EAST within the existing 3.5-second OPEN window. Fight or evade the three patrols and enter the vault sector.
4. Activate both vault relays. With the phase link and access prerequisites complete, the Guardian awakens. Its brief reveal suspends the field, supports skip and respects reduced motion.
5. The Guardian seals the sector exit. Survive its warnings and attack during recovery; defeat is required for vault authorization. A defeat event releases the barrier once and removes active projectiles.
6. Open the central vault, recover the core, return south and interact at extraction. Early extraction and pre-Guardian vault access are rejected.
7. Results stop gameplay and show outcome, reason where relevant, field time, objective checklist, patrol kills, damage, shots/hits and Guardian outcome. Restart/replay creates fresh enemy/security/puzzle/boss/projectile state. Return to the menu ends the completed run.

## Architecture

```text
src/features/rivals/
  missions/
    types.ts             mission/objective states and typed data contracts
    definitions.ts       THE LAUNCH, objective graph, markers, modes, boss hook
    MissionEngine.ts     validated transitions, event evidence, timers, counters
    progression.ts       separate browser-only practice records and receipts
    mission.test.ts      mission/expiry/reward/prerequisite coverage
  boss/
    definitions.ts       health, thresholds, patterns, windups, recovery, cooldowns
    BossController.ts    pure fixed-step encounter rules, damage and phase model
    BossSystem.ts        Phaser rendering/collision, lockdown, shared combat hooks
    boss.test.ts         phases, every ability, shields, stagger, death, navigation
  ui/
    MissionResults.tsx   accessible terminal results/replay menu
    BossHUD.tsx          responsive boss health/phase/warning/skip interface
  missions.css           scoped mission/results/boss presentation
```

Integration reuses `ArenaSession`, `ArenaScene`, `CombatSystem`, `ProjectilePool`, `Health`, `NavigationGrid`, `EnvironmentLayer`, `WorldState`, the current asset loader, audio and input adapters. `GamingPage`, briefing/HUD/minimap/menu components connect mode selection, objective markers and results. Existing movement/combat/AI/security code remains in use.

Mission states are NOT_STARTED → PREPARING → ACTIVE → SUCCESS / FAILED / ABANDONED. Terminal outcomes cannot transition again. Objective dependencies are checked for missing references and cycles. Valid latched world facts can be reconciled after prerequisites become available; an early extraction action is discarded. Mission unlock prerequisites can gate preparation. The shipped mission has none. Optional objective deadlines are supported and unit-tested; no extra objective countdown is imposed on this beginner mission.

All clocks use fixed-step field seconds. Pause, hidden-tab pause, hacking and the reveal stop the mission clock. The challenge warns at 60/30/10 seconds and fails at zero. Under severe CPU stalls, the existing bounded simulation slows field time; this is a local practice clock, not a competitive real-time authority.

HUD publication remains batched/throttled. Objective UI selects stable values; dormant boss UI does not rerender on position updates. Boss pursuit paths are cached for 0.8 seconds and rebuild against geometry revisions. Boss shots use the existing 48-entry projectile pool; telegraphs reuse a graphics object. There are no boss timer/listener chains or combat network requests. Scene teardown unregisters its damage target, collision bodies and render objects.

## Guardian balance and presentation

- **450 HP**, phase B at **65%**, phase C at **30%**. These thresholds and all attack timings are definition data.
- A: deliberate pursuit, three-shot fan and charged shot. B: faster cadence, five-shot fans, a short reposition and a targeted pulse. C: shorter pauses and a charged/pulse/fan/reposition pattern.
- Fan: 0.85 s warning, 9 damage per projectile, 250 px/s. Charge: 1.15 s warning, 18 damage, 320 px/s; charging armor halves incoming damage.
- Pulse: locks the player's position at windup start, warns for 1.4 s, radius 88 px, 16 damage once. Walking/dodging out avoids it; solid cover occludes its hit check.
- Reposition: 0.65 s warning and a short collision-limited movement, with no hidden contact damage. No dedicated dash attack animation is claimed.
- Recovery windows are 0.8–1.4 seconds. Phase shifts are protected for 0.85 seconds and clear old projectiles. Sustained pressure can stagger for 1.1 seconds with a 9-second cooldown. Ordinary dodging retains the existing brief immunity rules.
- ROOK artwork, supplied weapon/impact assets, a restrained amber/red ring, phase flash, reveal camera pan and procedural collapse are reused. Reduced motion shortens the reveal and removes pan/flash/collapse rotation. No authored mechanical boss model or unique boss animation cycle is claimed.

## Practice progression and preserved data

`rivals_practice_progress_v1` is a separate browser storage key. It contains completion count, **practice XP**, best times separated by standard/timed mode, a local Guardian-clearance badge, recent history (50 entries) and per-run receipts. Each successful run earns 100 practice XP, plus 25 for the optional uplink. Failed/abandoned runs earn zero. The receipt prevents saving the same result twice; a genuine replay is a new run. Denied/full storage leaves the current result playable and displays that it was not saved.

These records are non-economic, editable browser practice data. They are not account Arena XP, ranked results, currency, NFTs, inventory or server-verified unlocks. No RIVALS authoritative validation/reward backend exists here; the inspected `/game` routes and `GameSession` schema belong to the retired paid card game. They are not reused. No backend routes/models, mining balances, BD Points, wallets, claims, transactions, entitlements or databases are modified.

## Handoff and limits

Future authorized work can add authored Guardian/enemy animation assets through the existing manifest, extend mission definitions and provide an authoritative RIVALS run/replay-validation backend in separate collections. Economic rewards must stay disabled until authoritative validation and transactional idempotency exist. Local practice records must never be imported as trusted account rewards.

The current map is one vertical slice; adding other levels will require passing their geometry through the existing scene adapters. Dedicated Guardian art/attack/hurt/death cycles and boss-specific audio remain missing. This phase reuses compatible supplied assets rather than presenting target artwork as gameplay. Environment composition, wall joins, floor repetition and slower-CPU rendering still need work toward the final reference.

See [QA results, screenshots and measured limitations](RIVALS_COMBINED_04_QA.md). Physical Android/iOS, Safari/Firefox, thermal soak, deployment and authenticated production end-to-end sessions require separate verification. Do not advance to combined prompt 5 automatically.
