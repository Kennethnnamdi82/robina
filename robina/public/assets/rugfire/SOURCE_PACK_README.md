# RUG FIRE — Tactical Asset Pack (Browser 3D Prototype)

## Start here
This is an original procedural shooter prototype asset pack; it does NOT reach the requested reference-character realism. All 3D files are glTF 2.0 binary `.glb` files, all audio is `.ogg` and `.wav`.
The 5 characters have articulated body-part nodes and 9 glTF animation clips inside their GLB files.

**Important honest visual disclaimer:** These characters are PROTOTYPE original procedural humanoids, not AAA human scans, hand-sculpted characters, or skinned/motion-captured soldiers. They still look stylized; the included reference image is the *visual target*, not proof that these GLBs match it. Motion uses parent-child joint transforms rather than a deformation skin (glTF `skin`); clothing may intersect during extreme rotations. Full AAA requires a high-quality rigged human GLB with PBR maps, facial rig, clothing skin weights, animation retargeting and testing. The weapons, environment, sounds and integration scaffolding can be reused when replacing character visuals.

## How to install in a Vite React + TypeScript project
1. Unzip. Copy the contents of this folder to `<your Vite app>/public/assets/rugfire/` so `public/assets/rugfire/characters/KAI_BELMONT_PLAYER.glb` exists.
2. If missing, install `npm install three @react-three/fiber @react-three/drei` and `npm install -D @types/three`.
3. Open `integration/CODEX_MASTER_PROMPT.md`. Give the instructions to Codex along with the installed assets.
4. For an example, see `integration/RugFireCharacter.tsx` and `integration/RugFireAudio.ts`.
5. Use glTF `AnimationMixer`/`useAnimations`; character clips have these *exact* names:
`Idle_Breathe`, `Walk_Forward`, `Sprint_Forward`, `Combat_Aim`, `Shoot_Recoil`, `Reload`, `Crouch_Aim`, `Hit_React`, `Death_Fall`.
6. The static city arena can be loaded using `environment/LAUNCH_DISTRICT_ASSEMBLED.glb`. Use modular models to optimize/instance the level later.
7. Weapon + character alignment requires fitting the weapons to character hands and applying local transforms. `MuzzleSocket` joint is present in all weapons.
8. Set up collisions and third-person controller separately: these files are *assets*, not a finished game.

## Directories
- `characters` — five articulated GLB humanoids with 9 embedded animation clips each
- `weapons` — rifle, SMG, pistol
- `environment` — 10 modular map items + assembled street arena
- `props` — health, ammo, armor pickups
- `vfx` — 3 mesh-based visual FX; animate scale/opacity with your game code
- `audio/ogg` — compressed synthetic gunfire, footsteps, UI and ambient sounds
- `audio/wav` — uncompressed versions of the same
- `textures` — original procedural detail textures
- `previews` — actual render + previously generated player concept reference
- `integration` — Codex implementation prompt and code examples

## Art direction
Original game: RUG FIRE. Urban finance-cyberpunk third-person tactical action. Dark graphite textiles, orange signal highlights, dirty concrete and wet asphalt, sinister banking district enemies.
Default scale: 1 unit = 1 meter. +Y vertical. Characters stand at ground Y≈0, look toward -Z. Level 44m x 44m (plus neighboring buildings).

## Asset licensing and provenance
All geometry and sounds generated procedurally in this session. No proprietary AAA character/game meshes or commercial effects included. The separately labeled concept-art image was generated in this conversation to communicate target aesthetics. Confirm rights for any future third-party meshes/animations you choose to add.
