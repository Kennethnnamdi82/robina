
RIVALS: RIVAL HEIST
COMBINED MASTER PROMPT 3 OF 10
ORIGINAL PHASES 7 + 8

INTELLIGENT ENEMY AI, SECURITY SYSTEMS, TRAPS, HACKING AND VAULT PUZZLES

ROLE:
Senior AI gameplay engineer, Phaser developer, level-system architect and game-performance specialist.

Continue from the existing RIVALS implementation.

MISSION:
Turn the level into a living, challenging heist environment with intelligent enemies, functioning security defenses and genuinely playable security puzzles.

Preserve existing combat, movement, maps, UI and legacy BaseDrop data.

==================================================
PART A — ORIGINAL PROMPT 7
INTELLIGENT ENEMY AI
==================================================

1. INSPECT

Review:
- Current player controller.
- Combat engine.
- Enemy sprites.
- Existing animations.
- Physics.
- Collisions.
- Map navigation.
- Spawn markers.
- Health/damage interfaces.

Reuse existing systems.

2. ENEMY AI ARCHITECTURE

Create modular AI controllers with states:
- IDLE.
- PATROL.
- SUSPICIOUS.
- INVESTIGATE.
- ALERT.
- CHASE.
- ATTACK.
- SEARCH.
- RETURN_TO_PATROL.
- HURT/STUNNED.
- DEAD.

Use a clean state machine.

Prevent conflicting state transitions and AI update loops.

3. ENEMY PERCEPTION

Implement:
- Configurable vision range.
- Vision cone.
- Line-of-sight detection.
- Wall occlusion.
- Detection buildup if appropriate.
- Last known player position.
- Investigation behavior.
- Loss-of-sight behavior.
- Configurable hearing reaction to combat noise.

Enemies must not detect players through solid walls.

4. ENEMY MOVEMENT

Support:
- Patrol routes.
- Navigation around obstacles.
- Investigation movement.
- Chasing.
- Returning to patrol.
- Repositioning.
- Appropriate attack distance.
- Stuck detection/recovery.

Reuse existing navigation and physics.

Introduce lightweight pathfinding only when needed.

5. ENEMY COMBAT

Integrate:
- Weapon firing.
- Attack cooldowns.
- Damage calculation.
- Enemy health.
- Hurt animations.
- Death animation.
- Combat effects.
- Target selection.
- Attack-range rules.

Enemies must stop attacking after death.

Avoid duplicate death events or rewards.

6. ENEMY ARCHETYPES

Implement:

STANDARD GUARD
- Patrol.
- Investigate.
- Chase.
- Attack.

RANGED ENFORCER
- Maintain distance.
- Fire ranged weapons.
- Reposition tactically.

HEAVY GUARD
- Higher health.
- Slower movement.
- Stronger telegraphed attacks.

Reuse compatible V4 artwork if dedicated enemy assets are unavailable.

7. ENEMY DIFFICULTY CONFIGURATION

Support:
- Health.
- Damage.
- Detection range.
- Detection speed.
- Movement speed.
- Attack accuracy.
- Attack intervals.
- Pursuit distance.
- Maximum concurrent pursuing enemies.

Keep balancing configurable and fair.

8. AI PERFORMANCE

- Stagger enemy decisions.
- Avoid pathfinding every frame.
- Reuse navigation data.
- Avoid scanning every entity each update.
- Reduce unnecessary offscreen AI work.
- Preserve valid mission simulation.
- Limit simultaneous expensive behavior.
- Clean up AI timers and subscriptions.

9. AI DEBUG MODE

Add development-only visual diagnostics where useful:
- Enemy state.
- Detection cone.
- Perception range.
- Patrol route.
- Navigation path.
- Current target.

Keep debugging disabled in production.

10. AI TESTING

Test:
- Patrol.
- Detection.
- Wall occlusion.
- Chase.
- Attack.
- Last-known-position search.
- Return to patrol.
- Stuck handling.
- Multiple enemies.
- Hurt/death states.
- Player respawn.
- Scene restart.
- Mobile performance.

==================================================
PART B — ORIGINAL PROMPT 8
SECURITY, TRAPS AND PUZZLES
==================================================

11. SECURITY ARCHITECTURE

Create reusable game systems for:
- Security devices.
- Alert states.
- Alarms.
- Traps.
- Terminals.
- Locked doors.
- Hacking.
- Vault access.
- Puzzle completion.
- Linked security events.

Make device placement and behavior configurable from map data.

12. LASER SECURITY

Implement:
- Visible laser beams.
- Active/inactive states.
- Timed activation.
- Warning effects.
- Configurable damage.
- Alarm triggering.
- Collision validation.
- Terminal-based disabling where supported.

Lasers must have clear warning and active visuals.

13. SECURITY CAMERAS

Implement:
- Scanning cones.
- Sweep movement.
- Detection range.
- Line-of-sight rules.
- Alert activation.
- Temporary disabling.
- Connection to enemy response behavior.

Cameras must not detect through solid objects.

14. HACKING MINIGAME

Create a lightweight, interactive hacking system.

Use a playable puzzle such as:
- Circuit routing.
- Sequence matching.

Include:
- Clear instructions.
- Mouse support.
- Touch support.
- Difficulty configuration.
- Optional timer.
- Success condition.
- Failure condition.
- Retry/reset behavior.

Successful hacking must alter the actual level state.

Examples:
- Unlock a door.
- Disable a laser grid.
- Disable a camera.
- Open a vault security route.

Never substitute a decorative animation for gameplay.

15. VAULT ACCESS SYSTEM

Implement:
- Locked vault doors.
- Required access conditions.
- Access terminals.
- Visible lock state.
- Unlock validation.
- Opening animations.
- Reusable vault interaction events.
- Appropriate audio/visual feedback.

16. ENVIRONMENTAL PUZZLES

Implement at least two functional puzzle types:

A. TIMED SECURITY SEQUENCE
Players must pass or activate security components during valid timing windows.

B. MULTI-SWITCH ACCESS
Players must activate required switches/terminals to unlock the intended area.

Use data-driven puzzle definitions.

17. SECURITY ALERT INTEGRATION

Connect the alarm network to Phase 7 AI.

Expected behavior:
- Player is detected by a camera, laser or relevant device.
- Alarm activates.
- Eligible enemies investigate or become alerted.
- Security UI updates.
- Alarm persists or resets according to defined rules.
- No infinite enemy spawning.
- No duplicated alert event loops.

18. GAME FEEL

Add lightweight:
- Camera scanner visual effects.
- Laser warning effects.
- Terminal interaction feedback.
- Vault unlock effects.
- Trap warning indicators.
- Alarm sounds.
- Puzzle success/failure feedback.

Support non-color-only hazard indicators.

19. SECURITY PERFORMANCE

- Avoid unnecessary per-frame security scans.
- Reuse Phaser geometry.
- Limit active effects.
- Share event systems.
- Clean up subscriptions.
- Avoid uncontrolled AI alert fan-out.
- Use efficient collision queries.
- Preserve mobile responsiveness.

20. SECURITY TESTING

Test:
- Laser activation.
- Laser collision.
- Camera detection.
- Detection occlusion.
- Hacking success/failure.
- Door unlocking.
- Puzzle sequence reset.
- Alarm triggering.
- AI reaction.
- Scene restart.
- Mobile controls.
- Vault accessibility.
- No impossible mandatory puzzles.

==================================================
INTEGRATED GAMEPLAY TEST
==================================================

Run a real gameplay sequence:

Spawn player.
Explore Neon District.
Encounter guards.
Avoid detection.
Trigger an alarm.
Observe enemy reaction.
Fight or evade enemies.
Approach security terminal.
Complete hacking puzzle.
Disable linked security.
Unlock vault access route.

All systems must interact through real gameplay events.

Do not fake interactions or victory states.

Run:
- Unit tests.
- Integration tests.
- AI state tests.
- Security tests.
- Existing project tests.
- Production build.
- Mobile performance checks.

FINAL DELIVERABLE:
A functioning intelligent-enemy system and a fully interactive heist-security layer.

WORKFLOW:
INSPECT → IMPLEMENT AI → TEST AI →
IMPLEMENT SECURITY → INTEGRATE →
TEST → FIX → VERIFY → DOCUMENT.

Report exact implemented mechanics, changed files, actual test results and limitations.

Do not proceed to the next combined prompt.
