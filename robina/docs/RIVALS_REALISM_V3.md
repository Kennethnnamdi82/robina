# RIVALS visual upgrade — 14 November 2026

This is an in-engine graphics revision, not a claim of GTA/AAA equivalence.
The existing mission, damage, movement, traffic, police and authoritative result
rules remain in place. No replacement city simulation or client health authority
was added.

## Implemented

- A textured 15,517-triangle military operative replaces the unarmoured base
  body. The existing animation library is rest-space retargeted onto its own
  skeleton; hand sockets account for the different palm axis. All five digits
  participate in the procedural third-person grip.
- The higher-detail prepared car replaces the reduced fleet silhouette. Paint,
  glass, rubber and delivery livery retain separate materials; clearcoat,
  environment reflections, restrained lamp sizes and lower-panel dust improve
  their presentation. Existing vehicle entities, dimensions and controls remain.
- Six showcase facades are separated from the supplied combined district and
  aligned to existing building footprints. Shop floors, repeatable apartment
  storeys and roof sections are assembled at the required height rather than
  compressing a tall apartment block into a single-storey building.
- The showcase palms, cafe sets and distant skyline supplement the district.
  Its demonstration roads, closed bank shell and static reference cars are
  deliberately NOT layered onto the playable grid or existing traffic.
- 2K PBR colour/normal/roughness maps now drive roads, paving, masonry and
  concrete. Interior walls/counters use world-metre UVs, including the supplied
  wood material, instead of stretching one texture across every cube.
- The shoulder camera is closer and lower, with a narrower perspective. All
  four POVs, zoom controls and collision checks remain available.
- Brighter indirect fill, softer daylight/golden presentation and higher-detail
  shadows replace crushed-black street shadows. High includes HDR, GTAO contact
  shading and restrained bloom on both web and Android. High is the default for
  new preferences; explicit saved quality choices are respected. Medium/Low
  remain single-pass alternatives. High adaptive resolution does not drop below
  native resolution.

## Assets and preparation

Runtime assets: `public/assets/rivals/realism/`. Source packs remain unchanged.
`scripts/prepare-realism-assets.mjs` downloads approved static materials, records
archive hashes, bounds output textures to 2048 pixels, segments the source GLBs,
and exports the retargeted operative. Runtime requires no asset provider APIs.

Run the preparation script with `--offline` to reuse downloaded source maps,
or `--offline --materials-only` to rebuild only textures. Raw downloads live
under ignored `.tools/realism-materials`, never in the distributed game.

Material provenance and SHA-256 values are in `material-sources.json`.
[ambientCG's CC0 license](https://docs.ambientcg.com/license/) covers the selected
[asphalt](https://ambientcg.com/view?id=Asphalt001),
[paving](https://ambientcg.com/view?id=PavingStones152),
[brick](https://ambientcg.com/view?id=Bricks101) and
[concrete](https://ambientcg.com/view?id=Concrete049) materials. Asphalt001 is
an approximation, not a photogrammetry claim. Existing car/truck attribution
remains in `public/assets/rivals/city/premium/CREDITS.txt`.

The military model was supplied by the project owner as
`src/features/Military_Male_03.glb`; its upstream license was not included with
that file. The owner must confirm redistribution rights. The showcase pack
describes its original procedural geometry as commercially redistributable.
The existing Universal animation library is CC0 (included license unchanged).

## Verification and release boundaries

- `npm run typecheck`
- `npm exec -- vitest run src/features/rivals/three`
- `npm run build`
- `node scripts/verify-realism-scenes.mjs --all` against `npm run dev:rivals3d`
- `node scripts/verify-realism-scenes.mjs --high` checks the full postprocess path
- `npx cap sync android` and `npm run android:verify`

`tests/realism` is a gated DEV-only visual fixture using the actual RaidRuntime
and a bank mission. It freezes simulation so each shot is reproducible; it is
not evidence of a completed live mission. Actual-play screenshots can also be
captured with `scripts/capture-realism.mjs`. Output is under
`docs/rivals-3d/realism-v3`. Neither entry is imported by the production app.

Software-rendered browser measurements are NOT hardware performance evidence.
No physical Android performance or universal frame-rate guarantee is claimed.
Some supplied street/civilian/truck geometry is still stylised; this revision
does not turn every asset into a photo-scanned AAA model.

The Capacitor app bundles the game. A Vercel website deployment cannot update an
already-installed APK. A newly signed Android build must pass the existing CI
release workflow and be installed by the player. Do not call asset sync an APK
release, or a pending CI job a completed deployment.
