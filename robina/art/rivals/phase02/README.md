# Phase 02 art sources

Mode: built-in image generation and image editing. No external generation API, paid art service, or Python image editing was used. Supplied RIVALS cinematic showroom art provided style direction. The new operatives are human and more realistically proportioned than the original V4 playable chibi sheets.

The PNGs are source artwork. `scripts/prepare-rivals-visuals.mjs` performs deterministic alpha-bound inspection, normalization, packing and compressed runtime export. Do not use the source contact sheets as full-screen playable backgrounds.

## Prompt set / production specifications

These specifications record the art direction and layout constraints used in the generation passes. They also provide the instructions for replacement art. The generation model can vary exact dimensions and spacing, so the exporter explicitly repacks the machinery and normalizes individual character frames.

### Machinery — `neon-machinery-source.png`

Create a premium production game prop atlas for RIVALS, a cinematic futuristic stealth/heist game. Sixteen separate detailed hand-painted 2.5D objects in a four-by-four layout: armored crate, data console, illuminated sealed vault door, reactor, support pillar, security door, horizontal barricade, vertical barricade, security camera, floor vent, lockers, holographic terminal, industrial pipes, cyan light column, cable reel, equipment case. Orthographic three-quarter top-down view, looking from the south; no isometric diamond ground planes. Consistent blue-black steel, cyan screens, controlled violet and amber accents, crisp metal details and coherent light direction. Transparent background, isolated objects with generous padding, no labels, logos, UI, character, room, or floor backdrop.

### Floor — `neon-floor-source.png`

Create a four-by-four atlas of sixteen square top-down futuristic industrial floor tiles for the same game. Slate-blue steel and concrete panels, fine scratches, restrained seams and rivets, subtle vents/grates and security thresholds. Opaque seamless material cells; no room illustration, raised objects, characters, labels, grid captions, dramatic perspective, or painted cast shadows from absent objects. Keep the floor quieter than the characters and machinery. Consistent scale and dark cinematic palette.

### VEX — `vex-walk-source.png`, `vex-walk-transparent.png`

Create a detailed adult human futuristic male operative in blue-black tactical armor with a restrained purple scarf/cape accent. Realistic-looking stylized anatomy, practical armor, uncovered human head, premium hand-painted 2.5D sprite art, no weapon. A clean six-column by four-row walking sprite sheet: south, west, east, north rows, six natural consecutive walking poses per direction. Consistent proportions, view angle, scale, lighting, centered columns and foot baseline. Orthographic three-quarter top-down game perspective, no isometric diamond. No labels, logos, background, ground plane, baked glow, or props. Transparent background and generous cell padding.

The second VEX pass cleaned the alpha/background while retaining the character design, six-by-four layout, and pose directions. The transparent version is the exporter input; the initial source is retained for provenance.

### NYX — `nyx-walk-transparent.png`

Use the VEX sprite sheet as the layout/style reference. Replace the operative with NYX, an adult silver-haired human woman in practical dark futuristic tactical armor with a restrained violet scarf accent. Maintain matching anatomy scale, detail, lighting, view angle, six walking poses per direction, four rows south/west/east/north, consistent foot baselines and cell layout. No weapons, labels, scenery, ground, baked shadows/glow, or UI. True transparent background.

### ROOK — `rook-walk-transparent.png`

Use the VEX sprite sheet as the layout/style reference. Replace the operative with ROOK, an adult brown-skinned human man in heavier navy tactical armor with restrained amber details. Maintain matching human proportions, scene perspective, rendering detail, six walking poses per direction, four rows south/west/east/north, consistent scale and feet. No weapons, text, props, scenery, floor plane, baked shadows/glow, or UI. True transparent background.

### Walls — `neon-walls-source.png`

Create eight modular detailed wall pieces in a four-column by two-row atlas, matching the machinery/floor style: horizontal wall, vertical wall, corner, junction, amber wall lamp section, glass section, ventilation section, end cap. Dark blue-black industrial metal with restrained cyan/amber trim, believable thickness and wear. Orthographic three-quarter top-down view from the south, coherent vertical edges and consistent scale, no isometric diamond composition. Separate transparent objects with generous padding; no rooms, floor backdrop, characters, labels, logos, or UI.

## Runtime outputs

The final game assets are saved to `public/assets/rivals/phase02/`. Characters are 1152×768 WebP atlases with 192px cells; machinery is a 1024px square atlas, walls 1024×512, and floor tiles a 512px square atlas. Character portraits are 128px WebP exports. The manifests record exact dimensions, paths, bytes and hashes.

## Known art limitations

Generated sequential art needs further human animation polish. Foot anchoring and frame bounds are normalized, but silhouettes, cloth, hands and anatomy can vary between frames. Only walking is authored; stationary idle, accelerated walk for run/dash, and stationary action slots are explicitly temporary fallbacks. No matching attack, hit-reaction, defeat, dedicated idle, run or dash cycles are claimed. Future art passes should preserve the stable atlas names and direction ordering, use the existing pivot, and be tested in motion at gameplay size.
