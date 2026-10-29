# CODEX PHASE 2 — Build real, playable top-down Rival Heist

Implement an isolated `/arena` experience with Phaser + TypeScript inside existing React app. Use original images from `public/game-assets/`; use `demo/src/main.ts` as a **throwaway prototype example**, not a production template. Follow `docs/GAMEPLAY_DESIGN_BIBLE.md`.

Build one polished Training Vault, then Neon District. Four-direction animated movement and idle, dash with cooldown, basic melee attack, damage/invulnerability with feedback, enemy drone patrol/chase, lasers, two terminals, Vault Core and extraction. Display working health, timer, minimap and mission objective UI; support Android touch controls as well as desktop keyboard; handle pause, restart, and settings, including reduced-motion. Add sound and VFX; ensure collisions and death/timeout states. Keep native mobile browser performant.

Quality gates: user can complete 2-terminal-core-extraction mission, die/restart, and play on 360px Android browser without controls obstructing missions. Capture actual screenshots/video and run browser smoke tests. All local scores are temporary display-only. No work on mining, marketplace or cash rewards.
