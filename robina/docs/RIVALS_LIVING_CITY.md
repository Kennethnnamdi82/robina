# RIVALS outdoor living city — 3 November 2026

This modifies the existing development-only RIVALS 3D raid. The old compound partitions are replaced with a 96 × 96 metre playable street district. The original player model, animations, weapons, input, combat rules and mission prerequisites are retained. Roadside cover/utility props and the east relay cabinet move onto pavement to keep traffic lanes clear; their IDs, interactions and mission markers remain connected. Other interaction coordinates are retained. The original Phaser level is not edited.

> Correction pass: [RIVALS_CITY_REVISION.md](RIVALS_CITY_REVISION.md) supersedes
> the distance-LOD, rigid pedestrian geometry and collision descriptions below.
> Its screenshots and regression results describe the current implementation.

## Implemented

- One deterministic city plan supplies architectural footprints, navigation tiles, building collision heights and seeded district styling. Downtown, freight and residential variants share an authored connected street network. Riverside Square keeps the original mission interactions accessible outdoors. Mission route validation runs within the objective area plus a detour margin.
- Textured asphalt with aggregate and cracks, continuous roads, double centre lines, stop lines, zebra crossings, paving, curbs, planted squares, trees, benches, storefront signs, awnings, bus shelters, hydrants, bins, rooftop equipment, parked cars and a surrounding skyline.
- Eight traffic types from the supplied licensed asset pack: sedans, coupes, taxis, police vehicles, vans, lorries, fuel tankers and buses. Vehicles follow rounded right-turn routes, brake for signals, maintain headway, and yield to the operative, combatants and civilians. Dynamic player/camera collision boxes use each model's measured dimensions. Vehicles are scenery actors, not driveable or destructible vehicles.
- A synchronized 34-second signal cycle includes amber, clearance and protected all-red pedestrian intervals. Civilians use sidewalk loops and controlled crossings, have varied clothing, pace and brief idle periods, avoid solid scenery, and flee after nearby player gunfire or grenade blasts. They are separate from security combat AI.
- Generated sunset panorama and alpha foliage cards, warm sun/sky fill, distance fog, window illumination and three nearby street-light pools at night. Pause → City Atmosphere selects Golden Hour, Daylight or After Dark. Existing combat smoke, blast and impact effects are retained.
- Quiet synthesized wind/traffic rumble and occasional nearby horns obey existing pause, mute and volume settings. Audio resources are disposed with the raid.
- Architecture and ground transforms do not depend on the camera. Player-distance LOD substitutes detailed supplied architecture with lighter authored models, dressed by a shared brick/window facade shader. Trees, road markings, scenery and civilians use shared geometry/materials or instancing. Only High enables sun shadows.

| Quality | Moving vehicles | Civilians | Grass | Detailed building radius |
| --- | ---: | ---: | ---: | ---: |
| Low | 18 | 24 | 135 | 30 m |
| Medium | 24 | 36 | 324 | 48 m |
| High | 28 | 48 | 540 | 48 m |

The city is a bounded mission district, not an infinite world. Street topology remains authored; seeds vary architectural height/type, district, mission venue and later atmosphere. Buildings are exterior shells rather than enterable interiors. The traffic models and simplified distant architecture retain some of the supplied pack's stylization. This is not a claim of a pixel-exact match to the reference screenshots or of photorealism.

## Verification

- City/operation/physics/control unit checks: **29 passed across four files in 16.59 seconds**, including lane clearance and 90 simulated seconds of circulation with the actual mission furniture. Every active vehicle travelled more than 25 metres across repeated signal cycles. An earlier simultaneous browser/unit run timed out during repeated route validation; reducing its search bounds retained route checks.
- Two browser scenarios passed together in 5.4 minutes. Coverage in `tests/rivals3d/living-city.spec.ts`: real asset requests; advancing traffic and pedestrian counters; all four camera modes without a new run or changed city signature; frozen simulation while paused; quality counts; phone landscape layout; changed city on restart; clean exit; lighting presets; no page/shader errors; and civilian response to real firing input.
- After the roadside equipment relocation, the atmosphere/assets/gunfire browser scenario passed again in 2.1 minutes. The retained sunset/day/night captures and rendering JSON were refreshed from that run.
- Browser captures and rendering diagnostics are under `test-results/rivals3d/`, with selected captures retained in `docs/rivals-3d/living-city/`.
- Whole-project TypeScript checking remains blocked by existing `FirstPersonWeapon` API mismatches in `CombatPresentation.test.ts` and `RaidRuntime.ts`: seven-argument `update` calls versus its six-argument signature, and absent `handsVisible`, `handsAttachedToWeapon`, and `handMeshCount`. These player/weapon files were not repaired as part of an environment-only request.
- The Chrome runner uses software WebGL. The final sampled Low third-person view measured about 1.13 FPS, 124 draw calls and 134k submitted triangles. This is test-runner evidence, not phone performance. Physical Android frame rate, heat and sustained play remain unverified; a 30 FPS claim would be unsupported.

## Assets and reproduction

Architecture: existing Quaternius Downtown City GLBs and shared textures, recorded in `public/assets/rivals/city/manifest.json`. Traffic, furnishings and skyline silhouettes: supplied **Free Low Poly Simple Urban City 3D Asset Pack**, by **Syoma Pozdeev**, CC BY 4.0. Source metadata and attribution are retained in `public/assets/rivals/city/LIVING-CITY-CREDITS.txt`.

`node scripts/prepare-living-city.mjs` copies the supplied 2,570,628-byte atlas without changing its source. No new asset library download or dependency installation was needed.

The built-in image-generation tool produced two environment textures, then `scripts/prepare-city-textures.mjs <sky-source.png> <foliage-source.png>` encoded the selected outputs for mobile:

- `public/assets/rivals/city/sunset-sky.webp`: 1536 × 768, 84,392 bytes.
- `public/assets/rivals/city/oak-foliage.webp`: 768 × 768, 256,122 bytes, alpha preserved.

### Final sky prompt

Use case: photorealistic-natural. Asset type: seamless equirectangular panoramic sunset SKY TEXTURE for a playable outdoor Three.js city action game, not a gameplay screenshot. Create an expansive atmospheric evening sky with cinematic burnt amber sunlight at the low horizon, layers of dramatic soft charcoal and bronze cumulus clouds, muted blue-gray upper sky, subtle glowing cloud edges, realistic natural cloud detail and aerial perspective. Composition: very wide 2:1 panorama intended to wrap around a skydome, horizon at the bottom edge, zenith at the top. Sky ONLY from edge to edge: NO ground, NO ocean, NO buildings, NO landscape, NO people, NO vehicles, NO text, NO interface. Match the reference direction of a warm late-afternoon urban action game while keeping soft realistic photographic cloud detail, believable exposure, and subdued saturation. Light mostly from one low sunset glow, not multiple suns. Make left and right edges visually compatible for wrapping. This bitmap will be integrated as the sky behind an actual living 3D city.

### Final foliage prompt

Use case: photorealistic-natural. Asset type: alpha-tested foliage texture for 3D tree canopy cards in a mobile city game. A single dense, organic oval cluster of small realistic green broadleaf foliage, like a leafy oak branch bough, isolated on a genuinely transparent background. The subject fills most of a square image with margin around its irregular silhouette. Many individually readable leaves, dark olive recesses and muted sage-green highlights, fine twigs mostly hidden, natural gaps between leaves with transparent holes. Soft neutral diffuse daylight so a 3D engine can apply warm sunset light. Rich natural texture, photographic botanical realism, slightly untidy asymmetrical edges. No whole tree, no trunk, no pot, no ground, no sky, no shadow outside the foliage, no text, no border. It will be layered into an actual 3D tree crown, so show a front-facing approximately round foliage cluster with subtle volume, not a flat graphic symbol. Preserve real alpha transparency.

## Run

From `robina/robina`: `node scripts/dev-rivals3d.mjs`. On the computer open `http://localhost:8084/`; on a phone use the printed Network URL on the same Wi-Fi. Keep the server and computer running. Cycle VIEW to TPS to inspect the streets at ground level.

The handoff preview runs in a hidden background Node process, with stdout/stderr in `node_modules/.vite-rivals3d/phone-server.*.log`. `http://10.209.150.72:8084/tests/rivals3d/index.html` returned HTTP 200 after switching to that background process. The address may change when Wi-Fi changes; this is a local preview rather than a public deployment.

No deployment, account writes, dependency updates, branch operations or production routing changes were performed.
