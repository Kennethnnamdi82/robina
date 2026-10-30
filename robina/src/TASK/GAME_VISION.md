# RIVALS: RIVAL HEIST
## OFFICIAL GAME VISION, PRODUCT IDENTITY & DEVELOPMENT CONTEXT

**DOCUMENT TYPE:** Game Design Vision and Product Context

**PURPOSE:** Establish a complete understanding of RIVALS before continuing implementation.

**IMPORTANT:** This is NOT an implementation prompt. Do not modify source code, install dependencies, create game systems, or begin development in response to this document.

Your responsibility is to understand the vision, mechanics, player experience, features, and long-term objectives of RIVALS.

Treat this document as the authoritative creative direction for subsequent implementation prompts, while recognizing that future approved decisions may update individual requirements.

---

# 1. PROJECT IDENTITY

**Game Name:** RIVALS

**Flagship Game:** RIVAL HEIST

**Tagline:** RAID. DEFEND. CONQUER.

**Genre:** Competitive Action-Adventure / Vault Raiding / Player-Created Challenges

**Visual Style:** Cinematic 2D/2.5D, futuristic, detailed, dark, atmospheric, neon-lit.

**Platform:** Web browsers, optimized for desktop and mobile.

**Primary Engine:** Phaser with TypeScript.

**Application:** React and TypeScript.

**Backend:** Node.js and Express.

**Database:** MongoDB.

**Real-time Communication:** Socket.IO where genuinely required.

**Blockchain:** Base, optionally used for supported gaming collectibles and purchases.

## CORE PRODUCT DEFINITION

RIVALS is a premium futuristic action game where players become elite operatives who infiltrate dangerous facilities, fight enemies, disable security systems, solve puzzles, recover mission objectives, and escape.

Players can compete against other players' records and eventually design their own vaults for other players to raid.

The game's core identity is built around:

RAID — DEFEND — COMPETE — PROGRESS.

RIVALS is fundamentally a GAME, not a cryptocurrency mining platform or financial application.

Every major feature should strengthen the gameplay experience.

---

# 2. THE GAME WORLD

The game takes place in NEXUS CITY, a fictional futuristic metropolis controlled by powerful corporations and technologically advanced security organizations.

Within this world are high-security facilities known as Vaults.

These Vaults contain restricted technology, classified information, valuable mission objectives, and mysterious energy cores.

AEGIS CORPORATION controls many of these facilities.

The corporation operates automated security systems, drones, advanced robots, and powerful mechanical guardians.

A secret underground competition has emerged among elite operatives who infiltrate these facilities.

These operatives are known as RIVALS.

Their objective is to complete dangerous operations, establish superior records, uncover the secrets of Nexus City, and become legendary operatives.

This fictional world provides the narrative foundation for missions, maps, characters, factions, boss encounters, and future seasons.

Storytelling should support gameplay without requiring lengthy dialogue or disruptive cutscenes.

---

# 3. THE PLAYER

Every player controls a futuristic operative.

The initial character roster consists of:

**VEX:** A masked futuristic infiltrator representing agility, precision, and tactical skill.

**NYX:** A sleek, mysterious operative with a distinctive stealth-oriented visual identity.

**ROOK:** A heavily armored operative with a powerful tactical appearance.

Characters must have professional animation systems, consistent visual proportions, expressive movement, and distinctive personalities.

Initial competitive gameplay should preserve equal overall character effectiveness.

Cosmetic purchases must never provide unfair advantages.

Character selection affects appearance and presentation unless explicitly approved balancing rules introduce differentiated abilities.

---

# 4. THE PRIMARY GAMEPLAY

The main gameplay is a top-down 2D/2.5D action-adventure experience.

The player controls their operative in real time.

The character can:

- Move in multiple directions.
- Run and navigate environments.
- Dodge attacks.
- Use appropriate weapons.
- Attack enemies.
- Take damage.
- Interact with security devices.
- Activate terminals.
- Solve environmental puzzles.
- Recover mission objectives.
- Escape through extraction points.

The game must contain actual interactive gameplay.

It must NEVER be represented by static screenshots, fake character movement, or decorative-only interfaces.

---

# 5. THE CORE GAMEPLAY LOOP

The intended loop is:

ENTER ARENA
→ SELECT OPERATION
→ CHOOSE OPERATIVE
→ LOAD MISSION
→ INFILTRATE FACILITY
→ FIGHT OR EVADE ENEMIES
→ DISABLE SECURITY
→ COMPLETE OBJECTIVES
→ RECOVER VAULT CORE
→ REACH EXTRACTION
→ RECEIVE RESULTS
→ PROGRESS
→ CHALLENGE RIVALS
→ PLAY AGAIN.

Successful gameplay should require skill, timing, exploration, tactical decision-making, and objective completion.

It must not rely primarily on random results or payment.

---

# 6. FIRST OFFICIAL MISSION

## OPERATION 001 — NEON DISTRICT: SECURITY BREACH

This is the initial flagship mission and the reference experience against which the game's foundational quality should be evaluated.

### Setting

A futuristic security facility in Neon District.

The environment contains illuminated corridors, security rooms, automated defenses, interactive terminals, and a protected central vault.

### Starting conditions

The player enters with a standard operative, full health, and a mission timer.

The initial target mission duration is approximately three minutes.

The exact duration and difficulty may be adjusted through gameplay testing.

### Mission sequence

**STAGE 1 — INFILTRATION**

The player enters the facility and begins navigating the environment.

**STAGE 2 — SECURITY CONTACT**

Security drones detect and attack the player.

The player must fight or evade enemies while preserving health.

**STAGE 3 — ENVIRONMENTAL HAZARDS**

Laser barriers, patrol routes, and other security systems obstruct movement.

The player must navigate them.

**STAGE 4 — TERMINAL ACCESS**

The player locates and activates two security terminals.

These terminals unlock the protected vault.

**STAGE 5 — VAULT BREACH**

The player reaches the central vault and retrieves the Vault Core.

**STAGE 6 — LOCKDOWN**

Recovering the Vault Core activates additional security pressure.

**STAGE 7 — EXTRACTION**

The player must reach the extraction point before the mission timer expires or their health reaches zero.

**STAGE 8 — RESULTS**

The game evaluates the mission and displays the final outcome.

---

# 7. VICTORY, FAILURE, AND SCORING

A mission succeeds when the player completes all mandatory objectives and reaches extraction within the permitted conditions.

A mission fails when the player's health reaches zero, the timer expires, or another clearly disclosed failure condition occurs.

The results screen should communicate:

- Mission outcome.
- Completion time.
- Objectives completed.
- Enemies defeated.
- Damage taken.
- Final score.
- Arena XP earned.
- Relevant crafting rewards.
- Achievement progress.
- Personal or competitive records.

Scores must be calculated according to consistent, documented rules.

Competitive scores must be validated by authoritative server-side systems or an appropriate replay-validation architecture.

Never trust arbitrary scores submitted by the browser.

Failure should permit a quick restart without requiring payment.

---

# 8. OFFICIAL GAME MODES

## MODE A — STORY EXPEDITIONS

Official narrative missions created for the Rivals universe.

These introduce environments, enemies, story developments, and new gameplay mechanics.

## MODE B — VAULT RAIDS

Skill-based challenges where players infiltrate vaults and attempt to complete objectives successfully.

Vaults may be official or created by other players.

## MODE C — RIVAL DUELS

Competitive challenges in which players attempt the same version of a vault.

The initial approach should support asynchronous competition.

Players do not need to be online simultaneously.

## MODE D — BOSS OPERATIONS

Special missions featuring powerful enemies, advanced attack patterns, and distinct combat phases.

## MODE E — TRAINING

A safe environment for learning movement, combat, interactions, and other fundamental mechanics.

All modes must build on shared gameplay foundations rather than functioning as unrelated games.

---

# 9. VAULT ARCHITECT — THE DEFINING FEATURE

RIVALS should eventually allow players to create and publish their own vaults.

The Vault Architect is a visual level-building system.

Players can configure:

- Walkable areas and walls.
- Entrances and exits.
- Security doors.
- Laser traps.
- Security drones.
- Interactive terminals.
- Environmental obstacles.
- Decorative objects.
- Vault Core locations.
- Extraction points.

The editor must enforce construction rules.

Vault creators must complete a test run before publication.

The system should also verify required paths, object limits, and basic layout validity.

Published competitive vault versions must remain stable so players compete under identical conditions.

Vault creators can track attempts, successful completions, records, and available replay information.

The Vault Architect is a long-term core differentiator for RIVALS.

---

# 10. RIVALRIES AND COMPETITION

RIVALS must encourage fair, skill-based competition.

Players should eventually be able to:

Challenge another player's vault.

Attempt to break existing records.

Invite friends to complete the same challenge.

Compare verified scores.

View seasonal rankings.

Compete against ghost replays.

Earn achievements for significant accomplishments.

Ghost replays represent previously recorded gameplay actions.

They allow players to race against past performances without requiring simultaneous multiplayer sessions.

Advanced live multiplayer is a potential future expansion, not a prerequisite for the initial game.

Competitive rewards and rankings must never be purchasable.

---

# 11. GAME PROGRESSION

The new game should contain several clearly separated progression systems.

**Arena XP:** Represents gameplay experience and increases the player's Arena level.

**Arena Rating:** Represents competitive performance.

**Crafting Materials:** Non-transferable resources earned through gameplay and used for supported crafting activities.

**Achievements:** Recognize verified milestones.

**Season Progression:** Tracks progress through seasonal objectives and reward tiers.

These systems must not be confused with cryptocurrency balances.

Gameplay progression should be rewarding without requiring users to spend money.

---

# 12. CHARACTER CUSTOMIZATION

Players should be able to customize their gaming identity.

Cosmetic categories may include:

Character skins.

Armor appearances.

Weapon appearances.

Victory animations.

Character introduction animations.

Profile frames.

Visual effects.

Vault decorations.

Customization must not undermine competitive fairness.

Core gameplay must remain accessible to players who never purchase cosmetics.

---

# 13. SEASONS AND EVENTS

RIVALS should support structured seasons containing new missions, challenges, cosmetics, achievements, and competitive activities.

Each season should have a theme.

Examples include:

SHADOW UPRISING.

NEON REBELLION.

PHANTOM PROTOCOL.

REACTOR MELTDOWN.

A Season Pass may provide additional premium cosmetic rewards.

The free reward track must remain meaningful.

Limited-time events may introduce special bosses, community challenges, or unique environments.

Events should provide fresh activities without forcing players into excessive repetitive gameplay.

---

# 14. VISUAL DESIGN PHILOSOPHY

The target is a cinematic 2D/2.5D action game with a detailed futuristic aesthetic.

The supplied RIVALS visual reference images establish the desired production appearance.

The actual game should feature:

High-detail futuristic environments.

Detailed human-like operative artwork.

Consistent elevated camera perspective.

Smooth directional animations.

Atmospheric lighting.

Neon illumination.

Dynamic environmental effects.

Professional combat feedback.

Readable interface elements.

Responsive camera movement.

Beautiful but functional mission screens.

High-quality visual transitions.

Professional desktop and mobile interfaces.

Visual polish must enhance gameplay clarity.

Do not replace independent interactive assets with a single static background.

The visual target must be approached through proper sprites, environment assets, layers, animation systems, particles, lighting, and rendering techniques.

If existing artwork is inadequate, the limitation should be identified honestly.

---

# 15. SOUND DESIGN

Audio is an important part of the game identity.

RIVALS should eventually feature:

Futuristic ambient music.

Character footsteps.

Weapon sounds.

Enemy detection warnings.

Laser activation sounds.

Environmental machinery.

Terminal interactions.

Vault unlocking sounds.

Combat impacts.

Boss encounter audio.

Extraction alarms.

Mission victory and failure cues.

Audio should respond to gameplay events.

Volume and mute controls should be available.

Sound effects should enhance immersion without overwhelming the player.

---

# 16. USER INTERFACE

RIVALS should resemble a premium game rather than an ordinary website dashboard.

The key interfaces are:

**HOME:** Player character, current progress, featured missions, and important updates.

**PLAY / ARENA:** Main entry point to gameplay.

**OPERATIVES:** Character selection and customization.

**MY VAULT:** Player-created vaults and Vault Architect.

**EXPEDITIONS:** Official story missions.

**RANKINGS:** Competitive standings and records.

**SEASONS:** Seasonal progression and rewards.

**STORE:** Optional gaming cosmetics and passes.

**PROFILE:** Player identity, achievements, and historical performance.

The playable game scene should occupy most of the screen during active gameplay.

Menus and decorative effects must not obstruct gameplay.

Navigation should be intuitive on both mobile and desktop.

---

# 17. MOBILE EXPERIENCE

Mobile support is a core requirement.

Players must be able to enjoy RIVALS on supported Android and iOS browsers.

The game should provide:

Responsive layouts.

Virtual joystick movement.

Touch action buttons.

Readable health and objective indicators.

Appropriate control positioning.

Efficient rendering.

Reasonable loading times.

Configurable graphics quality.

Smooth gameplay on supported hardware.

Desktop controls should support keyboard and mouse.

Mobile controls must be designed specifically for touch rather than simply shrinking desktop controls.

---

# 18. PERFORMANCE PHILOSOPHY

RIVALS should feel responsive and lightweight despite its detailed visual presentation.

Important principles include:

Efficient sprite atlases.

Proper asset compression.

Scene-specific loading.

Avoiding unnecessary network requests.

Efficient collision processing.

Object pooling where beneficial.

Controlled particle counts.

Texture memory management.

Proper cleanup of Phaser scenes.

Responsive input handling.

Graphics quality settings.

The target is smooth gameplay on both desktop and supported mobile hardware.

Performance must be measured rather than assumed.

Visual effects should scale according to device capabilities.

---

# 19. MONETIZATION PHILOSOPHY

RIVALS is a free-to-play game.

Players must be able to enjoy the core gaming experience without paying.

The principal proposed revenue streams are:

**COSMETIC SHOP**

Character skins, weapon appearances, animations, and visual customizations.

**SEASON PASS**

Optional premium cosmetic progression.

**VAULT CUSTOMIZATION**

Premium environment themes, vault appearances, and decorations.

**OPTIONAL NFT COLLECTIBLES**

Selected gaming cosmetics may support ownership on Base.

NFT functionality is optional and should not prevent ordinary players from enjoying the game.

The initial release must not depend on NFT purchases.

There should be no pay-to-win mechanics, mandatory paid mission retries, or paid randomized rewards involving monetary prizes.

Payment-provider support must be confirmed from the actual repository; do not assume integrations are complete.

---

# 20. RETIRED BASEDROP FUNCTIONALITY

RIVALS originated from the earlier BaseDrop application.

The product direction has changed.

RIVALS is now focused on gaming.

The following systems are not part of the new active gameplay experience:

Cryptocurrency mining.

Mining timers.

Mining claims.

Auto-mining.

The old paid eight-card treasure-opening game.

Unrelated cryptocurrency earning mechanics.

A new speculative cryptocurrency token.

However, existing user information, balances, historical records, legitimate entitlements, and transaction history must not be deleted or silently invalidated.

Any retirement or migration must preserve these records and address outstanding obligations.

The new gaming experience should remain separate from retired functionality.

---

# 21. SECURITY AND FAIRNESS

RIVALS must maintain fair competition.

The game should protect against:

Forged scores.

Manipulated mission results.

Impossible movement speeds.

Unauthorized reward claims.

Duplicate rewards.

Replay attacks.

Fraudulent payment confirmations.

Invalid player-created vaults.

Unauthorized access to player inventories.

Competitive outcomes must be verifiable through the appropriate backend architecture.

Security controls must be proportionate to the risk of each system.

Do not describe an anti-cheat system as secure merely because the frontend performs validation.

---

# 22. THE LONG-TERM EXPERIENCE

The completed RIVALS experience should feel like this:

A new player enters Nexus City.

They select their operative.

They complete their first security breach.

They fight enemies and escape with the Vault Core.

They receive verified results.

They improve their skills.

They complete additional expeditions.

They discover new enemies and environments.

They earn achievements.

They customize their character.

They challenge other players' records.

They eventually design their own vault.

Other players attempt to conquer it.

The player becomes part of an active competitive community.

Fresh seasons introduce new missions, challenges, cosmetics, and environments.

The world continues expanding while preserving the same underlying game identity.

The player returns because the action, competition, progression, creation, and mastery are genuinely enjoyable.

---

# 23. THE FINAL PRODUCT STANDARD

The goal is not simply to build a functioning browser game.

The goal is to create a polished, cinematic, responsive, enjoyable, commercially viable action game.

Its defining qualities should be:

**ENGAGING:** The gameplay is enjoyable and rewards skill.

**COMPETITIVE:** Players can challenge one another fairly.

**CREATIVE:** Players can create vaults and challenges.

**CINEMATIC:** The artwork, environments, animations, and presentation feel premium.

**ACCESSIBLE:** Players can enjoy the game without cryptocurrency knowledge.

**FAST:** The game loads efficiently and responds smoothly.

**SUSTAINABLE:** Optional cosmetic purchases support continued development without undermining gameplay.

---

# 24. DEVELOPMENT CONTEXT

The project follows a previously established 22-prompt development roadmap.

Prompt 01 covers foundational architecture, project integration, and a basic playable scene.

Prompt 02 covers professional asset integration and cinematic visual foundations.

Later prompts cover interfaces, character systems, environments, combat, enemies, security mechanisms, missions, bosses, expeditions, player-created vaults, competition, progression, monetization, and production readiness.

This document does not replace those implementation prompts.

It explains the intended product that those prompts will progressively build.

Not every feature described here is already implemented.

Inspect the actual repository to distinguish existing functionality from future requirements whenever an implementation phase begins.

---

# FINAL INSTRUCTION

Read and understand this complete RIVALS Game Vision document.

Use it as the creative and product context for future development instructions.

Do not begin coding.

Do not install dependencies.

Do not modify files.

Do not implement new systems.

Do not automatically advance to another development phase.

For now, respond only with:

1. Your understanding of what RIVALS is.
2. The main gameplay loop.
3. The defining role of Vault Architect.
4. The intended visual and technical direction.
5. The systems that are planned rather than confirmed as implemented.
6. The non-negotiable product principles you will preserve.

**RIVALS: RIVAL HEIST — RAID. DEFEND. CONQUER.**