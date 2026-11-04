# City smoothness and camera revision

Follow-up: the gameplay GRAPHICS shortcut has since been removed at the user's request. Graphics remain on the start/pause screens. Canvas-resize flashing is fixed separately; see `RIVALS_CAMERA_STABILITY.md` for the current presentation path and checks.

Implemented after the 3 November 2026 premium-art pass. Player model, weapon assets, bindings and combat damage rules are unchanged.

## Changes

- Building geometry is prepared offline, preserving recessed windows and repeating brick UVs. One shared PBR atlas reduces each foreground building to two material draws. No distance-based building mesh replacement was introduced.
- The exterior car is consolidated from 34 render parts to ten, with four real wheel pivots and a fixed 17,730-triangle mesh (previously 31,600). Equivalent fleet types share instance batches instead of rendering a separate batch for every label.
- Low/Medium use one direct scene render, ACES tone mapping and native antialiasing. The previous default half-float multisampling and multi-pass bloom are removed. High retains optional half-resolution bloom.
- Low/Medium use inset building-massing shadow proxies. High retains detailed building shadows. Medium refreshes the shadow map at 20 Hz rather than rerendering all window detail every frame.
- Resolution adapts to sustained wall-clock frame cost, with hysteresis before recovery. Physics, geometry, controls and traffic/crowd population do not change when pixel resolution adapts.
- Low/Medium/High are visible before entry and accessible through a dedicated GRAPHICS shortcut during play. Manual choices persist locally, including across restarts. A constrained phone starts in Low unless the user has already chosen otherwise. High postprocessing falls back to a standard render target if floating-point colour rendering is unavailable, and its temporary targets are released when returning to a lighter preset.
- Binary city loading runs alongside actor loading. Downloaded bytes are shared with welcome-screen prefetch and reused after restart, but disposed GPU objects are never reused. Failed downloads are evicted and may be retried.
- Mixed indexed/nonindexed primitives no longer disable batching for an entire security actor. Vertex values are expanded unchanged before the existing animated-joint-local merge; the player skin is excluded.
- Prepared gzip sidecars are served through standard HTTP content encoding by the dedicated local sandbox server. The original assets are untouched; a stale sidecar is ignored.
- The shooting camera uses a critically damped render-only impulse: a small upward kick, alternating lateral response, subtle roll and FOV response, with less motion while aiming. Camera shake disabled/reduced motion clears feedback. Base orientation is restored before gameplay aim rays, so visual feedback cannot accumulate aim drift.
- Camera follow is no longer updated both in fixed simulation steps and again during render. Player presentation and camera tracking interpolate between fixed ticks. Subtle travel sway and damped recovery replace the old one-frame rotation.
- Asphalt is less artificially dark/glossy, paving is toned down, and restrained repair/tyre-wear decals add surface history without introducing colliders. Utility props receive a muted finish. Floating artificial light plates are removed from the upgraded car/truck fleet; their authored lamps remain.
- Pedestrians keep the shared authored skeleton/locomotion atlas. Crowd-only material changes add jacket/shirt variations, collars, seams and distance-filtered fabric detail, plus less-matte eyes. The player's geometry and materials remain unchanged.

## Rebuild assets

Run from the frontend root:

```powershell
node scripts/prepare-city-fast.mjs
node scripts/prepare-city-transfer.mjs
```

`prepare-city-transfer.mjs` uses the recorded baseline resource list plus the prepared fleet/building assets. Generated GLBs and audits are in `public/assets/rivals/city/optimized/`; transport sidecars sit next to the original binary files. Credits and underlying licences remain those recorded in `RIVALS_PREMIUM_ART.md` and `public/assets/rivals/city/premium/CREDITS.txt`. No new third-party asset or dependency was added in this revision.

## Verification and limits

- Final focused unit suite: **53 tests passed in ten files**. This includes visible/persisted graphics choices, one-pass default rendering, safe mixed-layout batching with skinned/mirrored exclusions, recoil recovery/frame-rate independence, base-aim restoration, reduced motion, pause freezing, resolution hysteresis (including frames longer than one second), download deduplication/retry/cancellation, road collision, camera geometry stability, controls and operation navigation.
- Actual-game profiling script: `node scripts/profile-city-smoothness.mjs <label>`. Reports and the final street image are in `docs/rivals-3d/art-direction/`. It records click-to-playing time, actual WebGL renderer, runtime draws/triangles, resource timing and browser errors.
- Initial software-renderer baseline: 54,723 ms to playing, 897 submitted draws, 2,208,054 triangles. First optimized capture: 29,871 ms, 463 draws. The shadow/vehicle capture (`smoothness-final.json`) measured 35,150 ms, 438 draws, 1,812,806 triangles and 10,282,766 encoded asset bytes with no browser errors. It predates the final security-rig batching and catastrophic-frame recovery fixes.
- The first full browser movement/firing/camera regression passed movement and firing assertions, then timed out during Playwright's camera-button action under software-rendering overload. The follow-up uses a smaller viewport, verifies the Medium default, then switches to Low to exercise controls and all camera views. This is a functional test, not a Medium/mobile FPS certification.
- The follow-up full-input run was interrupted after extended software-renderer overload; it is **not counted as a pass**. A separate lightweight graphics-preset/persistence and actual Low-scene shader smoke is in `scripts/verify-city-presets.mjs`, with its own audit record.
- That preset smoke **passed**: all three choices, reload persistence, the in-game shortcut, pause/settings and the actual Low scene compiled/rendered with no browser errors. Click-to-playing on this software renderer was 29,645 ms. It does not meet a seconds-fast cold-start target on this machine.
- These are development-server runs using **SwiftShader software rendering**, not a physical-phone benchmark. The browser could not create a D3D11 hardware context. Random district seeds, process contention and shader-cache state vary between runs. The original resource-timing buffer truncated late baseline entries; its 20.9 MB transfer total is a lower bound, not a complete download audit.
- A seconds-fast cold start and 30/60 FPS on a physical phone are **not verified**. The software renderer is still slow and is not an acceptable shipping target. Workload and startup structure are improved; do not describe this as a finished AAA or performance-certified release.
- Whole-project TypeScript checking still reports the existing first-person weapon API mismatch (missing hand-state accessors and extra update argument). The environment/camera additions introduce no additional type diagnostics.

The dedicated local preview remains `http://10.209.150.72:8084/tests/rivals3d/index.html`, on the development computer's Wi-Fi network. This is not a deployment or public URL.
