
RIVALS: RIVAL HEIST
COMBINED MASTER PROMPT 4 OF 10
ORIGINAL PHASES 9 + 10

COMPLETE MISSION ENGINE, HEIST GAMEPLAY LOOP AND CINEMATIC BOSS BATTLES

ROLE:
Senior game systems engineer, Phaser developer, mission designer and combat gameplay specialist.

Continue directly from the previous combined phases.

MISSION:
Connect all existing mechanics into a complete replayable heist mission, then build a challenging multi-phase boss encounter into that experience.

Do not replace existing working movement, combat, AI, security, assets or UI.

==================================================
PART A — ORIGINAL PROMPT 9
COMPLETE MISSION ENGINE
==================================================

1. INSPECT

Review:
- Mission scenes.
- Player controller.
- Combat.
- AI.
- Security systems.
- Vault objects.
- HUD.
- Existing progression schemas.
- Backend APIs.
- Mission result interfaces.

2. MISSION DATA MODEL

Create a typed, data-driven mission system supporting:
- Mission ID.
- Mission name.
- Description.
- Difficulty.
- Objectives.
- Prerequisites.
- Spawn locations.
- Optional objectives.
- Timer configuration.
- Success conditions.
- Failure conditions.
- Rewards.
- Replay support.
- Boss encounter hooks.

3. MISSION STATE MACHINE

Support:
- NOT_STARTED.
- PREPARING.
- ACTIVE.
- SUCCESS.
- FAILED.
- ABANDONED.

Validate all transitions.

Prevent multiple mission completions or contradictory success/failure states.

4. FIRST COMPLETE MISSION — THE LAUNCH

Create an end-to-end heist inside the Neon District.

STAGE 1 — INFILTRATION
- Spawn player.
- Display briefing.
- Present initial objective.
- Navigate toward restricted compound.

STAGE 2 — SECURITY BREACH
- Navigate traps.
- Avoid/disable lasers.
- Hack terminal.
- Unlock security route.

STAGE 3 — SURVIVAL
- Encounter guards.
- Use combat.
- Dodge attacks.
- Use tactical movement.
- Allow evasion when intended.

STAGE 4 — VAULT CORE
- Access vault room.
- Satisfy vault conditions.
- Open vault.
- Collect/recover Vault Core.
- Update objective.

STAGE 5 — EXTRACTION
- Reveal extraction objective.
- Reach extraction zone.
- Validate objective completion.
- Finish mission.

Integrate the boss encounter from Part B at the correct stage.

5. OBJECTIVE TRACKING

Implement:
- Objective state machine.
- Objective prerequisites.
- Active objective.
- Completed objectives.
- Optional objectives.
- Objective markers.
- HUD updates.
- Gameplay event integration.

Objectives must only complete through valid events.

6. TIMERS

Support configurable:
- Mission timers.
- Objective timers.
- Countdown warnings.
- Expiration events.
- Pause/resume behavior.

Use appropriate game time sources.

Do not apply unfair default timers to beginner missions.

7. MISSION SUCCESS SCREEN

Show:
- Victory state.
- Mission name.
- Completion time.
- Objectives completed.
- Relevant verified statistics.
- Rewards earned where eligible.
- Replay action.
- Return to lobby.

8. MISSION FAILURE SCREEN

Show:
- Defeat state.
- Failure reason.
- Restart.
- Return to lobby.

9. PROGRESSION AND REWARDS

Create separate RIVALS progression data for:
- Mission completion.
- XP.
- Game-specific currency if applicable.
- Unlock conditions.
- Best time.
- Mission history.

Do not overwrite historical BaseDrop:
- User data.
- Mining balances.
- BD Points.
- Claim records.
- Transaction history.
- Wallet data.
- Existing entitlements.

Persistent economic rewards must be server-validated and idempotent.

If backend validation is unavailable, keep rewards clearly non-economic and distinguish practice-only progress.

10. REPLAYABILITY

Support:
- Restart.
- Replay.
- Best-time updates.
- Enemy reset.
- Security reset.
- Objective reset.
- Scene cleanup.
- No duplicated persistent rewards.

11. MISSION PERFORMANCE

- Event-driven mission updates.
- Minimal network dependencies during combat.
- Cached mission assets.
- Efficient UI synchronization.
- Smooth restart.
- Proper scene cleanup.

12. INITIAL FULL PLAYTHROUGH

Verify:
Launch → Mission Lobby → THE LAUNCH →
Infiltrate → Bypass Security →
Fight → Recover Vault Core →
Extract → Results → Replay.

Also test defeat and invalid extraction.

==================================================
PART B — ORIGINAL PROMPT 10
CINEMATIC BOSS BATTLES
==================================================

13. BOSS ARCHITECTURE

Create reusable boss definitions with:
- Boss ID.
- Boss name.
- Health/max health.
- Movement behavior.
- Attacks.
- Cooldowns.
- Attack patterns.
- Boss phases.
- Phase thresholds.
- Vulnerability windows.
- Stagger behavior where suitable.
- Death event.
- Mission conditions.

Reuse existing enemy combat and damage systems.

14. FIRST BOSS — VAULT GUARDIAN

Build a powerful enemy guarding the central vault security area.

Use existing V4 sprites.

If dedicated boss art is missing:
- Reuse compatible enemy artwork.
- Add restrained color/armor/glow distinctions.
- Scale carefully.
- Reuse existing attack effects.
- Document missing custom art.

Do not introduce huge new models.

15. BOSS PHASE A — DEFENSIVE

At high health:
- Deliberate movement.
- Ranged attacks.
- Readable attack patterns.
- Clear attack warnings.
- Appropriate recovery periods.

16. BOSS PHASE B — AGGRESSIVE

At configurable mid-health threshold:
- Increased pressure.
- Faster attack cadence.
- New projectile combinations.
- Repositioning.
- Clear attack telegraphs.
- Fair dodging opportunities.

17. BOSS PHASE C — FINAL STAND

At low health:
- Distinct dangerous behavior.
- Stronger telegraphed attacks.
- Limited arena hazards.
- Vulnerability windows.
- Intense but fair combat.

Make thresholds configurable.

18. BOSS ABILITIES

Build reusable patterns:
- Directional projectile burst.
- Charged projectile attack.
- Area-of-effect attack.
- Dash/reposition attack where assets support it.
- Temporary shield/defensive state where appropriate.

Each ability must include:
- Windup.
- Telegraph.
- Active phase.
- Recovery.
- Cooldown.

No unavoidable invisible attacks.

19. BOSS HEALTH UI

Implement:
- Boss name.
- Boss health bar.
- Phase information.
- Warning indicator.
- Vulnerability/stagger status if applicable.

Support desktop and mobile.

20. CINEMATIC BOSS PRESENTATION

Create:
- Brief entrance.
- Boss reveal.
- Controlled camera movement.
- Phase transition effects.
- Defeat sequence.
- Return to mission gameplay.

Allow skip or reduced motion.

Avoid long unskippable cinematics.

21. MISSION + BOSS INTEGRATION

Update THE LAUNCH:

- Player enters boss encounter.
- Intro plays.
- Boss activates.
- Arena rules activate.
- Player fights boss.
- Boss defeat registers exactly once.
- Required vault progression unlocks.
- Mission continues.
- Player extracts.
- Victory screen appears.

Prevent bypassing mandatory boss requirements.

22. BALANCING

Tune:
- Boss health.
- Damage.
- Attack speed.
- Projectile speed.
- Recovery windows.
- Vulnerability opportunities.
- Mobile difficulty.
- Fight duration.

Avoid turning difficulty into excessive health.

23. BOSS PERFORMANCE

- Pool projectiles.
- Pool visual effects.
- Efficient collision checks.
- Avoid expensive AI work every frame.
- Clean up all attack handlers.
- Prevent phase transition leaks.
- Maintain responsive controls.

24. BOSS TESTING

Verify:
- Spawn.
- Intro.
- Phase A/B/C.
- Every attack.
- Damage.
- Threshold transitions.
- Boss death.
- Mission unlock events.
- Player defeat.
- Restart.
- Pause/resume.
- Mobile input.
- No duplicated rewards.
- No leaked timers or objects.

==================================================
FINAL INTEGRATED ACCEPTANCE TEST
==================================================

Complete THE LAUNCH from start to finish with the Guardian boss included.

Test:
- Successful run.
- Failed run.
- Restart.
- Replay.
- Timer expiration.
- Objective prerequisites.
- Boss victory.
- Boss defeat of player.
- Final extraction.
- Duplicate reward prevention.
- Persistent progression.
- Mobile compatibility.
- Production build.

FINAL DELIVERABLE:
A complete playable single-player RIVALS vertical slice with a multi-phase Vault Guardian boss.

WORKFLOW:
INSPECT → IMPLEMENT MISSIONS →
TEST MISSIONS → BUILD BOSS →
INTEGRATE → FULL PLAYTHROUGH →
FIX → VERIFY → DOCUMENT.

Report changes, test results, performance findings and remaining limitations.

Do not proceed to the next combined prompt.
