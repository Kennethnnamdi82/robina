
RIVALS: RIVAL HEIST
COMBINED MASTER PROMPT 2 OF 10
ORIGINAL PHASES 5 + 6

GAME WORLD, MAP ARCHITECTURE, INTERACTIVE ENVIRONMENTS AND ADVANCED COMBAT ENGINE

ROLE:
Senior Phaser/TypeScript action-game engineer, level designer, gameplay programmer and performance specialist.

Continue from the existing RIVALS codebase after original Phases 3 and 4.

Do not restart the project.
Do not replace the current V4 asset foundation.
Preserve existing gameplay functionality and all historical BaseDrop records.

OVERALL MISSION:
Create a visually cohesive, explorable heist environment and implement satisfying, accurate, real-time combat.

==================================================
PART A — ORIGINAL PROMPT 5
GAME WORLD, MAPS AND ENVIRONMENTS
==================================================

1. INSPECT

Audit:
- Phaser scenes.
- Existing map files.
- Tilemaps.
- Environment sprites.
- Collision layers.
- Existing obstacles.
- Player spawn positions.
- Door objects.
- Terminals.
- Vault objects.
- Extraction markers.
- V4 asset manifest.
- Player physics.
- Camera boundaries.

2. WORLD ARCHITECTURE

Build a maintainable, data-driven world structure supporting:
- Floor/ground layers.
- Walls.
- Collision geometry.
- Decorative layers.
- Interactive objects.
- Obstacle layers.
- Cover objects.
- Lighting effects.
- Ambient effects.
- Player spawn points.
- Enemy spawn markers.
- Security markers.
- Vault rooms.
- Extraction points.

Use structured level definitions rather than scattered hardcoded coordinates.

3. FIRST LEVEL — THE LAUNCH / NEON DISTRICT

Build or refine a coherent explorable urban heist level.

Include:
- Recognizable player spawn.
- Navigable streets/corridors.
- Atmospheric neon scenery.
- Restricted security zones.
- Tactical cover locations.
- Interactive doors.
- Access terminals.
- Protected vault location.
- Extraction zone.
- Clear navigation cues.

Use existing level art and available V4 assets.

Do not introduce huge third-party models or unnecessary downloads.

4. COLLISION SYSTEM

Implement:
- Accurate wall collisions.
- Obstacle collisions.
- Nonblocking decorations.
- Door collision states.
- Correct world bounds.
- Configurable collision definitions.
- Reliable physics-body cleanup.

Prevent walking through solid scenery.

Ensure collision geometry aligns with visible artwork.

5. INTERACTIVE ENVIRONMENT OBJECTS

Build reusable interaction components for:
- Doors.
- Switches.
- Terminals.
- Vault access points.
- Collectible objects.
- Mission objective props.
- Extraction markers.

Support:
- Interaction ranges.
- Contextual prompts.
- Active/inactive states.
- Locked/unlocked conditions.
- Reusable interaction events.

Do not fake puzzle or mission completion.

Advanced security logic comes in the following development phase.

6. ENVIRONMENTAL VISUAL POLISH

Use:
- Lightweight neon effects.
- Appropriate rendering depth.
- Character/environment overlap.
- Subtle sign animations.
- Animated environmental props.
- Small ambient particle effects.
- Readable shadows.
- Atmospheric lighting.

Avoid expensive shaders or fullscreen effects when sprite-based effects achieve the same result.

7. LEVEL PERFORMANCE

- Cull irrelevant offscreen elements safely.
- Reuse textures and atlases.
- Cache static collision geometry.
- Minimize physics-body counts.
- Avoid reconstructing map collision every frame.
- Limit particles.
- Avoid duplicate assets.
- Support low-end devices.
- Keep initial download small.

8. WORLD TESTS

Test:
- Player spawn.
- Map traversal.
- Door interaction.
- Collision.
- Camera clamping.
- Navigation accessibility.
- Extraction marker positioning.
- Mobile camera zoom.
- Scene restart.
- Resize handling.
- No significant frame-time spikes.

Add development-only collision visualization if useful.

==================================================
PART B — ORIGINAL PROMPT 6
ADVANCED COMBAT ENGINE
==================================================

9. COMBAT SYSTEM AUDIT

Inspect:
- Player controller.
- Character animation state machine.
- Weapon sprites.
- Projectile sprites.
- Sound assets.
- Particle effects.
- Health indicators.
- Input mappings.
- Phaser physics.

10. MODULAR COMBAT ARCHITECTURE

Create reusable systems for:
- Weapon definitions.
- Weapon firing.
- Projectile spawning.
- Projectile collision.
- Damage calculations.
- Health management.
- Attack cooldowns.
- Equipment state.
- Player death.
- Combat feedback.
- Effect cleanup.

Avoid placing all combat code into one giant scene file.

11. WEAPON SYSTEM

Implement at least one genuinely functional ranged weapon using existing assets.

Create configurable weapon definitions for:
- Weapon ID.
- Damage.
- Fire rate.
- Projectile speed.
- Projectile lifetime/range.
- Accuracy/spread.
- Ammunition where applicable.
- Reload rules where applicable.
- Cooldowns.
- Recoil feedback.
- Impact effect.

Make adding future weapons straightforward.

12. AIMING AND SHOOTING

Desktop:
- Aim with mouse.
- Click to fire.
- Hold-to-fire for appropriate automatic weapons.
- Fire while moving.
- Correct directional projectiles.

Mobile:
- Touch aiming.
- Fire control or twin-stick setup.
- Multi-touch support.
- Shooting while moving.
- Reliable input cancellation.

Prevent firing while dead, paused or in incompatible states.

13. HEALTH AND DAMAGE

Implement:
- Current health.
- Maximum health.
- Damage events.
- Collision validation.
- Configurable invulnerability windows.
- Hurt animation.
- Health HUD updates.
- Death handling.
- Respawn/restart integration.
- Duplicate-damage prevention.

Create reusable interfaces for future enemies and bosses.

14. PROJECTILE SYSTEM

Implement:
- Projectile pooling.
- Projectile collision.
- Lifetime expiration.
- World-boundary cleanup.
- Impact events.
- Damage ownership.
- Appropriate collision filtering.

Prevent unlimited projectile accumulation.

15. COMBAT VISUAL EFFECTS

Add lightweight:
- Muzzle flashes.
- Projectile trails where appropriate.
- Hit particles.
- Impact effects.
- Hurt feedback.
- Hit confirmation.
- Modest camera shake.
- Weapon animations.
- Sound effects when available.

Effects must enhance readability without hiding enemies or hazards.

16. DODGE + COMBAT INTEGRATION

Connect existing dodge mechanics to combat.

Support:
- Dodge cooldown.
- Valid combat state transitions.
- Configurable invulnerability windows if intended.
- Recovery state.
- Appropriate attack restrictions.
- Prevention of permanent invulnerability exploits.

17. COMBAT SECURITY

Persistent competitive results and rewards must never be based only on untrusted browser damage values.

Keep interfaces compatible with future authoritative validation.

Do not falsely claim multiplayer authority already exists.

18. COMBAT PERFORMANCE

- Pool projectiles.
- Pool impact effects.
- Minimize update-loop allocations.
- Limit simultaneous particles.
- Use efficient physics collisions.
- Clean destroyed entities.
- Avoid expensive per-frame operations.
- Maintain stable input at varying frame rates.
- Enforce cooldowns using appropriate time sources.

19. PLAYABLE COMBAT TEST AREA

Use the existing level or a dedicated training zone with target objects.

Verify:
- Accurate aiming.
- Shooting.
- Projectiles.
- Target hits.
- Health reduction.
- Damage events.
- Death.
- Dodge.
- Mobile combat.
- Projectile cleanup.
- Scene restart.

==================================================
INTEGRATED TESTING
==================================================

Run:
- Map traversal tests.
- Collision tests.
- Door/terminal interaction tests.
- Camera tests.
- Combat tests.
- Damage tests.
- Projectile lifetime tests.
- Weapon cooldown tests.
- Player death/restart tests.
- Mobile controls tests.
- Variable frame-rate tests.
- Performance checks.
- Production build.
- Existing automated tests.

Ensure the player can enter THE LAUNCH, explore the environment, aim, shoot targets, dodge, receive damage and restart correctly.

FINAL DELIVERABLE:
A playable cinematic level with a functional real-time combat engine.

WORKFLOW:
INSPECT → BUILD WORLD → TEST WORLD →
BUILD COMBAT → INTEGRATE → TEST →
FIX → VERIFY → DOCUMENT.

Report implemented features, files, test outcomes, known limitations and performance concerns.

Do not proceed to the next combined prompt.
