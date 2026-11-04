# RIVALS city correction pass — 3 November 2026

This supersedes the distance-LOD and procedural-civilian sections of
`RIVALS_LIVING_CITY.md`. The player asset, controller tuning, input bindings,
weapons, damage and mission prerequisites are unchanged.

## Confirmed defects and changes

- Turning traffic used rotated *axis-aligned bounding boxes* for movement.
  Their empty corners blocked otherwise open asphalt. Traffic now supplies an
  oriented footprint to movement and camera/projectile ray intersection.
- The horizontal solver froze axes when an overlap already existed. The new
  substepped circle/rectangle contact solver separates overlaps and slides
  around rounded corners, including joints between wall segments.
- The previous distance LOD substituted differently shaped buildings. That
  system is removed. Three complete, closed architectural prototypes have
  photographic facade textures, recessed retail glazing, stone piers,
  cornices, roof parapets and service enclosures. Static instanced transforms
  are hashed in diagnostics; neither POV nor player distance changes them.
- A short orthographic side-camera boom retracted its clipping plane through
  scenery. The side eye now remains outside the district, with a fixed
  projection and direction. The tactical eye is also above the full skyline.
  Foreground geometry is not hidden or reshaped.
- Enemy visibility incorrectly used the *player's* line of sight, regardless
  of the active camera. Normal camera depth testing now decides visibility.
- Civilians' single-piece cylinder legs are removed. Independent instances
  use the supplied humanoid mesh and actual Idle/Walk/Jog skeletal cycles,
  baked into a shared bone-pose texture. Stride phase follows distance;
  stopping blends to idle and panic selects running. The player source is
  cloned, never recoloured or animated in place. Crowd-only vertex clustering
  retains skin weights and UV seams; fabric tint, a looser shirt surface and
  shoes are confined to these independent civilian copies. Only civilians
  intersecting the actual camera frustum are submitted for drawing; their
  off-screen navigation continues. Buildings do not use this per-person cull.
- Old development-test stairs overlapped the first road. City operations no
  longer include them; the original legacy conversion retains its test steps.
- Enemies retain their existing bodies, equipment and gameplay AI. Lower-body
  gaits are world-rest retargeted from the player's animation library, keeping
  their own proportions. Firing, reloading and flinching affect the upper
  body rather than freezing the knees. Death still uses the existing full
  authored death action and grounded presentation.
- Added sky-derived environment reflections, vehicle paint/rubber roughness
  separation and inexpensive contact-shadow decals. Removed obsolete floating
  cover-light strips. Low quality still avoids a real-time sun shadow map;
  civilians use contact decals rather than incorrect bind-pose cast shadows.
- Route validation caches an exact navigation-layout key. Every distinct
  layout is still validated, without repeating identical path searches for
  facade-only seed changes.

## Asset provenance

`src/features/realistic_city.glb` contains **Realistic city**, by **Pasha**,
CC BY 4.0:
https://sketchfab.com/3d-models/realistic-city-8dbfd6fc44c046c68853d9c95cc2918c

`scripts/prepare-realistic-blocks.mjs` extracts a shared photographic atlas
from the supplied source. The first cropped geometry experiment was rejected
after visual inspection; production uses the complete code-authored buildings
in `CityArchitecture.ts`, not those cropped meshes. The 3072-square WebP
facade atlas is approximately 557 KB. Attribution is retained in
`public/assets/rivals/city/REALISTIC-CITY-CREDITS.txt`.

Existing traffic/furniture attribution and generated sky/foliage provenance
remain in `RIVALS_LIVING_CITY.md`. No asset download or new dependency was
required for this correction pass.

## Verification

- **38 targeted unit tests pass across six files in 18.22 seconds.** Regression
  cases cover wall seams, empty truck AABB corners,
  overlap recovery, corner sliding and high-speed blocking.
- Five presentation tests cover: complete architecture/UVs,
  side near-plane stability through foreground cover, and retargeted bending
  knees with no source mutation or horizontal root travel, and crowd mesh
  simplification with normalized skin weights and an immutable source, and
  orthographic fog that does not use the distant eye's artificial depth.
- A real-asset close-up render and knee-quaternion samples are retained in
  `docs/rivals-3d/city-revision/human-gaits.{png,json}`. Isolated photographic
  architecture verification is in `building-preview.png`.
- Whole-project TypeScript checking has pre-existing `FirstPersonWeapon`
  update/signature and hands-diagnostic API errors in `RaidRuntime.ts` and
  `CombatPresentation.test.ts`. These unrelated player/weapon APIs are not
  altered by this pass.
- **The moving-camera browser regression passed in 6.5 minutes.** It exercises
  a real eight-metre walk in side view, unchanged architectural transforms in
  all four POVs, continued pedestrian navigation, frozen simulation on pause,
  gunfire-triggered fleeing, and an empty page/shader error list. Evidence is
  in `docs/rivals-3d/city-revision/revision-audit.json` and `revised-*.png`.
- A final orthographic-only fog correction follows that run: perspective keeps
  distance fog; tactical/side do not use the artificial far-away eye as fog
  depth. Its unit regression is included in the 38 tests; the separate final
  side-view capture is `side-fog-corrected.png`. That fresh Chrome smoke check
  also completed without page or shader errors (`side-fog-check.json`).
- The browser walk travelled 10.52 metres along X and the final civilian
  reaction count was six. The final fog-corrected software-rendered side sample
  submitted 128k triangles in 112 draws, with one visible civilian out of 24
  simulated. Its sampled 0.66 FPS is **software WebGL**, not a phone benchmark;
  it does not establish a physical-device frame-rate claim.
- The existing Wi-Fi preview at
  `http://10.209.150.72:8084/tests/rivals3d/index.html` returned HTTP 200.

## Remaining limitations

This is not AAA production art or a claim of matching the reference images.
Traffic and the original enemy bodies retain the supplied pack's stylization;
civilians currently share one body type. Buildings are exterior shells and
traffic is not driveable/destructible. The test environment uses software
WebGL; physical-phone frame rate, heat and sustained play are unverified.

Run `node scripts/dev-rivals3d.mjs` from `robina/robina`. Use the printed
network URL on a phone connected to the same Wi-Fi. After development hot
reloads, refresh the page and enter a fresh raid for a clean comparison.
