# RIVALS outdoor art revision — 3 November 2026

This is an implemented environment revision, not a claim that the game has reached production AAA quality. Player assets, weapons, bindings, combat rules and mission interactions are preserved.

## Implemented

- Foreground buildings now use the supplied authored architecture: recessed windows, brick, concrete, interior textures, normal and roughness maps. Mirrored geometry winding is corrected during baking. Buildings have independent culling bounds and are never substituted when changing camera or moving.
- Detailed exterior car and delivery-truck assets replace most of the previous fleet. Rigid wheel groups rotate about their real centres. Neutral body colours, original material response, camera-aware submission and mobile-sized textures are retained.
- A photographic tiled road surface, pavement normal mapping, compact HDR reflections, shadows at every quality level, restrained bloom and an HDR film/output pipeline replace the flat presentation.
- Golden-hour fill preserves readability in building shadows. Night lighting uses the closest three real street-light sources, illuminated windows and a cooler ambient fill.
- Smaller shop signs and physical terminal cabinets/recovery cases replace oversized signs and floating prototype geometry. Road closures use muted concrete barricades.
- Third-person and Medium graphics are now the initial presentation. All four cameras and all three quality settings remain available.

Remaining source-pack buses, tankers and some street props are still stylised. This pass does not make those assets photorealistic, add full destruction, or establish a mobile performance guarantee.

## Assets and provenance

Runtime assets, relative to the frontend root:

| Path | Size | Purpose |
| --- | ---: | --- |
| `public/assets/rivals/city/premium/street-car.glb` | 1,863,000 B | Curated 31,600-triangle exterior car, separate wheels |
| `public/assets/rivals/city/premium/delivery-truck.glb` | 188,120 B | Curated 3,624-triangle delivery vehicle |
| `public/assets/rivals/city/premium/asphalt-albedo.webp` | 482,382 B | Generated 1024-square tiled asphalt albedo |
| `public/assets/rivals/city/premium/evening-reflections.hdr` | 524,337 B | 512×256 reflection environment |

The car is adapted from [Khronos Car Concept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), Eric Chadwick / Darmstadt Graphics Group GmbH, CC BY 4.0. The truck is adapted from [Cesium Milk Truck](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMilkTruck), Cesium, CC BY 4.0. Original truck livery remains incidental artwork; no endorsement is implied. Exact adaptation credits are in `public/assets/rivals/city/premium/CREDITS.txt`. Source GLBs are preserved but not requested by the game.

The building kit was already supplied in the project (Quaternius Downtown City MegaKit, CC0). The HDR is derived from the user's supplied `src/features/modern_evening_street_4k.exr`; that original is unchanged and is not downloaded at runtime. Its upstream redistribution permission should be confirmed before a public release.

Preparation is reproducible with `scripts/prepare-premium-city.mjs <generated-road-png-path>`. It uses local Chrome, the existing Three.js tooling and WASM mesh simplification; no new package is required.

### Image-generation record

Mode: built-in image generation, new raster texture. Output: `public/assets/rivals/city/premium/asphalt-albedo.webp`; the original generated PNG is retained at `C:/Users/kenne/.codex/generated_images/01a1a04c-fb08-79f3-967b-f989349c1971/exec-0b2cf4af-8f96-4991-b24a-f443546b2a3b.png`.

Exact prompt:

> Use case: photorealistic-natural. Asset type: seamless tileable base-color texture for a realistic outdoor city game, not a scene or concept art. Produce one square high-resolution photographically realistic dark charcoal urban asphalt surface, directly overhead orthographic view of a 4 metre by 4 metre patch. Dense irregular tiny stone aggregate, subtle mottled weathering, fine restrained hairline cracks and old worn repair variations, traces of fine road dust. Dry to slightly damp, but NO puddles, no reflections, no road markings, no stripes, no curbs, no objects, no leaves, no text, no watermark. Even neutral diffuse illumination, no baked directional shadows, no vignette. All four edges must tile invisibly. Restrained real-world asphalt scale and microdetail, not stylized or painterly. The image will be an albedo texture on actual playable 3D roads.

## Verification

- Targeted movement, camera/presentation, controls, migration, operations and living-city simulation unit tests: 38 passed.
- Actual-game browser captures: `docs/rivals-3d/art-direction/premium-street.png`, `premium-night.png`, `premium-phone.png`. Initial day/night/phone capture completed without browser errors. Night and phone captures precede the final shadow-fill adjustment; the street capture is regenerated after that adjustment.
- `scripts/capture-premium-city.mjs` launches the actual local game, checks the default third-person view, records runtime state, and captures all three views; `--day-only` captures only the initial street. `premium-audit.json` contains the captured diagnostics.
- The capture machine's software rendering is extremely slow. Its measured frame rate is not acceptable as a shipping target and is not evidence of real-device performance. A physical-phone benchmark remains required; no 30/60 FPS claim is made.
- Full-project type checking has existing first-person weapon API mismatches (`update` argument count and missing hand-state accessors). These are not caused by the environment assets. See terminal output for exact diagnostics; the complete project is not type-clean.
- The full multi-camera Playwright suite has not been rerun against this final art revision. Its initial fleet expectations were updated for the new Medium default.

Local phone preview (same Wi-Fi as the development computer): `http://10.209.150.72:8084/tests/rivals3d/index.html`. The computer and preview process must remain running. This is not a public deployment.
