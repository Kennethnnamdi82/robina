# RUGFIRE supplied-asset integration

The current camera is third-person, following the user's latest choice. This is a browser combat vertical slice, not a claim of AAA visual quality.

## What is used

- Player: the supplied skinned cowboy/human GLB, with its original pistols and effects removed. It retains its supplied clothing and hat. No replacement human model was downloaded.
- Movement/combat: usable Basic Shooter Pack FBXs, transferred onto the human skeleton offline. Idle, movement, strafe, fire, reload, hit and evade play through an AnimationMixer. Root motion is removed so gameplay collision owns position. Forward movement reverses the valid backwards gait; sprint accelerates it.
- Enemies: Fake KOL, Rug Puller, Whale and Mega Rugger from the tactical pack, with their embedded animation clips. These are still rigid articulated prototype models, not realistic skinned soldiers.
- Weapons: downloaded AK-47 plus the tactical pack's SMG and pistol. Weapons switch visibly; the player's weapon follows the right hand. The gun's bundled combined shooting/reload timeline is not played independently; gameplay and actor clips control firing/reload timing.
- Environment: tactical barricades, sedan, crates and building façades; leafy-ground texture and upright grass tufts sampled from the supplied grass atlas, with instanced wind animation. The Blender scene geometry and EXR displacement maps are not imported at runtime.
- Audio: supplied OGG gunshots, footsteps, reload, hit, damage and city ambience. Web Audio starts after a gesture, honors mute/pause, and pans/attenuates enemy shots. Synthesized fallback sounds remain if an audio file cannot decode.
- Pickups: tactical ammo caches and medkits; each works once per mission.

## Preparation and deployment

Original downloads remain in `src/RUGFIRE_ASSETS/`, outside TypeScript/lint compilation and ignored by Git. Their example integration code depends on a different React stack and is reference material only. The existing Three.js renderer is retained; no React Three Fiber/Drei dependencies were added.

Run `npm run prepare:rugfire` locally with the original downloads present. The script uses installed Three.js and Playwright plus Chrome (`PLAYWRIGHT_CHROME_PATH` can override its location). It resizes textures, removes unused facial morph targets, transfers motion clips, and writes `public/assets/rugfire/` and the content version. Source downloads are untouched. Commit the prepared public assets and generated `assetVersion.ts` with the code; Vercel does not need Blender or the raw downloads.

The player GLB is approximately 2.2 MB versus the 15.3 MB original. Three game texture maps total about 550 KB. Models/textures preload together at the briefing, with progress, a bounded request timeout, a recoverable error and disabled entry until ready. Assets cannot load instantly on every network. A version query prevents stale immutable-cache responses across asset revisions.

## Source limitations

The current FBXLoader rejects `walking.fbx`, `rifle run.fbx`, `run backwards.fbx`, and `turning right 45 degrees.fbx` with `Unknown property type`. `X Bot.fbx` uses unsupported FBX 6100. These files are preserved and excluded from the playable asset preparation. The valid backwards/strafe/combat clips are used instead.

Asset rights and attribution follow the original downloads. The tactical pack's supplied provenance statement ships in `public/assets/rugfire/SOURCE_PACK_README.md`; separate third-party model download licenses were not supplied in this task and have not been independently verified.

## Verification scope

Browser tests exercise imported skin/animations, weapon switching, pickups, missing-asset handling, disposal during loading, keyboard/mouse combat, cover, boss phases, extraction and restart. Screenshots are under `test-results/`. Software-rendered headless Chrome can establish rendering correctness, not a 30–60 FPS hardware guarantee. The broader app retains its existing large wallet/auth vendor bundle.
