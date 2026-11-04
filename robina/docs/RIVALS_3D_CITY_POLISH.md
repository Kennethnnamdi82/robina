# RIVALS — Neon District environment pass

Implemented on `feature/rivals-3d-migration`. This is the existing playable 3D raid, not a separate showcase. Original Phaser, authentication, PWA, backend, production configuration and saved user records were not changed by this phase.

## Actual changes

- Supplied Downtown City architecture provides residential blocks, commercial facades and a headquarters landmark outside the existing security compound. Roads, curbs, sidewalk sections, bollards, drainage, planters and rooftop equipment use supplied assets.
- Supplied Modular SciFi wall/window sections replace the plain wall visuals. Computers, access hardware, crates, ventilation and reactor equipment dress the mission's existing locations and solid footprints.
- The insertion courtyard has a textured service lane and lane markings. The compound has a concrete floor, district signs, security lights, an external checkpoint and a small original service vehicle.
- Original tree canopies and alpha-tested grass animate with GPU wind. Planting sits outside the mission boundary, never across an enemy path or player route. The supplied packs did not include suitable tree models.
- Daylight, warm directional light, a cool sky fill, controlled distance fog and High-mode soft shadows replace the flat blue presentation. Existing ACES tone mapping and correct texture color spaces are retained.
- Tactical and side cameras cut down visual wall height to reveal the player. Full collision height remains unchanged. No roof covers a playable route. FPS/TPS retain the original collision-tested camera, weapon alignment and manual zoom.
- Existing left movement/right firing sticks, sprint, held jump, dodge, selectable weapon silhouettes, automatic reload, grenades, map and sound-on-entry remain. No SWITCH or RELOAD button was reintroduced.

## Asset preparation and architecture

`scripts/prepare-rivals-city.mjs` reads the supplied `Exports`, `Textures` and `Modular SciFi MegaKit[Standard]` directories without modifying them. It prepares **18 GLBs plus 40 shared WebP textures**, **8,381,658 bytes** in total. Texture dimensions are capped at 512 pixels; ORM maps at 256. The GLBs declare `EXT_texture_webp`. Unseen interior floor/wall primitives are omitted from decorative background buildings.

`public/assets/rivals/city/manifest.json` records source filenames, triangle counts, sizes and SHA-256 checksums. Raw source packs are excluded from Git; prepared assets and provenance ship with the feature.

- `CityAssets.ts`: loading and canonical texture/material ownership; sharing occurs before GPU upload. Normal maps are disabled on Low and restored on Medium/High.
- `CityEnvironment.ts`: district composition, collision-box-fitting panels and props, instanced architecture/foliage, shader wind, cutaway presentation, quality settings and disposal.
- `WorldArt.ts`: integration into the existing raid and batching of existing static trim/light geometry.
- `RaidAssets.ts` / `RaidRuntime.ts`: lifecycle integration, lighting, quality application, environment diagnostics and pause-safe updates.
- `SandboxApp.tsx` / `sandbox.css`: optional development FPS/frame-time monitor in the pause menu. Graphics changes now publish diagnostics even while paused.
- `tests/rivals3d/city.spec.ts`: actual WebGL loading, all camera modes without raid reset, graphics presets, paused wind and canvas cleanup.

The city pack is by Quaternius. Its [official Downtown City page](https://quaternius.com/packs/downtowncitymegakit.html) identifies the pack as CC0. The supplied SciFi Standard license is copied to `public/assets/rivals/city/SCIFI-LICENSE.txt`.

## Rendering and performance

Repeated wall sections, roads, furnishings, foliage and static trim use instancing and shared resources. Each skyline building has independent culling bounds so one visible facade does not draw every building. No post-processing chain, large HDR download or additional per-lamp dynamic light was introduced.

| Preset | Maximum DPR | Grass instances | Detail props | Normal maps | Shadow map |
| --- | --- | --- | --- | --- | --- |
| Low | 0.8 | 135 | Reduced | Off | Off |
| Medium | 1.1 | 324 | On | On | Off |
| High | 1.5 | 540 | On | On | 1024, soft |

Existing adaptive resolution may lower DPR further to 0.7. The performance monitor is disabled by default and can be enabled under Pause → Camera & Graphics.

The recorded headless Chrome runner uses **SwiftShader software WebGL**, not a phone GPU. In the city camera check, Low-mode views measured approximately **1.29-1.78 FPS**, **71-103 draw calls** and **81k-142k submitted triangles**. These measurements include development rendering and are deliberately reported, not treated as a success against the Android target. **Stable 30 FPS on a budget Android phone has not been established.** Physical hardware profiling is still required. See `docs/rivals-3d/city/runner.json` and `city-validation.json` for raw evidence.

## Verification

- TypeScript: passed.
- ESLint: zero errors; nine existing fast-refresh warnings in shared application UI/context files.
- Unit suite: **158 passed across 31 files**, rerun with one worker after the initial concurrent run hit a worker startup timeout.
- Normal application production build: passed; the sandbox is deliberately development-only and is verified through TypeScript and actual browser tests; existing vendor annotation and large-chunk warnings remain. No deployment was performed.
- Asset audit: all 18 model and 40 texture files match manifest checksums and texture size limits.
- City browser integration: passed; no page errors or failed asset requests. All four perspectives preserve position, run ID and enemy population; presets change foliage counts; pause freezes wind; exit removes the canvas.
- Seven selected browser scenarios passed across the completed runs: city integration; four-view muzzle/hand alignment and audio; sustained fire/automatic reload and bounded GPU pools; map/view/zoom/equipment controls; simultaneous mobile movement/fire/sprint and responsive HUD; held jump/evade/grenade fuse; and gate collision followed by a real guard kill with one settled corpse. The interrupted overnight test was rerun successfully. No assertions were removed; the four-view combat case allows additional time on software WebGL.
- Evidence: `test-results/city-completion` (3 passed) and `test-results/city-regressions` (4 earlier passed; its interrupted final case is superseded by the completion run). The complete 18-case browser suite and complete boss/extraction route were not rerun in this environment phase.

Actual gameplay screenshots are in `docs/rivals-3d/city/`: [tactical](rivals-3d/city/tactical.png), [side](rivals-3d/city/side.png), [third person](rivals-3d/city/third.png), [first person](rivals-3d/city/first.png). They are captures of the integrated game, not target artwork.

## Run and phone testing

From the frontend directory `C:\Users\kenne\Documents\RIVALS\robina\robina`:

```text
npm.cmd run dev:rivals3d -- --host 0.0.0.0
```

Open `http://localhost:8084/` on the laptop. On a phone on the same Wi-Fi, open `http://<laptop-Wi-Fi-IPv4>:8084/`. Keep the development server running. `ipconfig` shows the address; it can change when the network changes. This dedicated command enables the account-free 3D sandbox. The ordinary `npm run dev -- --host` command launches the main website instead.

Regenerate the curated pack with `npm.cmd run prepare:rivals:city`. The local source packs and Chrome are required. Re-run checks with `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test -- --maxWorkers=1`, `npm.cmd run build`, and `npx.cmd playwright test --config playwright.rivals3d.config.ts city.spec.ts controls-v2.spec.ts combat.spec.ts`.

## Practical limits and handoff

The existing mission footprint and all gameplay blockers remain authoritative. The surrounding city is scenery; this pass does not unlock a new open-world area or enterable residential interiors. The source pack's engine-specific fake-interior shader was not ported; its supplied window textures are used instead. Trees, service vehicle and signs are original lightweight geometry, not photorealistic scans. This is a stylized browser environment, not a claim of Call of Duty production parity.

Before a commercial release: profile representative physical Android/iOS hardware, inspect readability and sustained temperature/frame pacing, budget skyline/foliage density from those measurements, and play through the complete boss/extraction path on devices. Existing missing character-specific throw/evasion/FPS-arm art remains a separate phase. No future feature phase, account migration, deployment, branch merge or database operation was started.
