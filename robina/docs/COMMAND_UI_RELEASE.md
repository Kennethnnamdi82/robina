# RIVALS / COMMAND 02

Frontend-only visual refresh. Existing routes, authentication, API contracts,
catalog IDs/prices, checkout availability, read-only store account integration,
local progression, gameplay rules, controls and Capacitor packaging stay intact.

## Visual system

Graphite, charcoal, silver and restrained tactical red; locally packaged Barlow
Condensed headings with readable system body text. The font is distributed with
its SIL Open Font License at `public/assets/rivals/ui/OFL.txt` (upstream:
https://github.com/google/fonts/tree/main/ofl/barlowcondensed).

Character-centered lobby, operational site recon drawings generated from the
actual `SiteLayout` footprints, difficulty indicators, profile, podium/rankings,
customization, settings, equipment previews, recovery, confirmation and product
dialogs share the design language. Authentication, session restoration, error
states, native update/handoff screens and Three.js loading/pause/HUD are styled
without rebuilding their behavior. Soldier inspection remains explicit,
demand-rendered and disposed when closed; no lobby WebGL runtime is added.

## Soldier editions

Prices have NOT been changed to rounded example amounts.

| Existing item | Price | Distinct exported hardware |
| --- | --- | --- |
| Shadow Raider | $4.99 | Curved smoked visor, breacher mask, assault carrier and shoulder caps |
| Midnight Operator | $9.99 | Quad optical lenses, segmented navy armor, armored gauntlets, wrist instrument, radio backpack and antenna |
| Legendary Phantom Commander | $14.99 | Sealed helmet/respirator, titanium-gray layered ceramic armor, command pauldrons, shin guards, dual-antenna pack and split cloth mantle |

Other uniforms retain their own identities and existing bundle memberships.
Prepared WebP photographs and optional orbit-inspector GLBs are generated from
the exact same posed model. Metadata records actual hardware assemblies and
the collection manifest verifies hashes. Cosmetic silhouettes never change
health, hitboxes or movement. These remain showroom previews: this task does not
enable payments, grant ownership or equip a preview as a playable skin.

## Original artwork / generation record

Built-in image generation tool; no CLI/API key used. Approved output converted
to WebP without a composition change using `scripts/prepare-command-art.mjs`.
Project asset: `public/assets/rivals/hub/command-keyart-v2.webp` (213,526 bytes).
The original PNG remains in the generation output directory; no reference-game
artwork or logo is copied into the application.

Prompt:

> Use case: stylized-concept. Asset type: original cinematic background key art
> for the RIVALS: RIVAL HEIST military action game's main menu, not a UI mockup.
> Create a wide 16:9 composition in extremely high quality realistic AAA game
> promotional-render style. An ORIGINAL elite modern military heist operative
> stands at the CENTER of the image, framed full body from boots to head with
> ample headroom, facing camera with slight three-quarter turn, holding a
> detailed modern carbine muzzle safely down across the chest. Actual believable
> human face, short dark hair beneath high-cut graphite ballistic helmet, dark
> charcoal woven combat uniform, matte ceramic plate carrier, realistic pouches,
> gloves, rugged boots, tiny restrained red unit insignia, no recognizable
> licensed character. Background is an atmospheric evacuated financial-district
> street staging area at blue-gray dawn: monumental stone bank facade, distant
> concrete towers, wet pavement, faint mist and one red warning light. Cinematic
> but readable soft cool daylight key on face and silver rim light along armor.
> Premium material detail, refined composition, no futuristic glowing armor,
> no neon, no gold. Keep the LEFT QUARTER and RIGHT QUARTER of the entire
> composition relatively quiet, dark and uncluttered for overlay navigation.
> Character centered at 51 percent horizontal position; occupy roughly 80
> percent image height. Palette black, graphite, cool neutral silver, subtle
> dusty crimson accents. No text, no logos, no watermarks, no HUD, no panels,
> no interface elements. The attached game screenshot is inspiration for
> character-centered lobby composition only; do not copy its character, assets,
> palette or branding.

## QA

`playwright.command.config.ts` exercises real local or built application routes
with isolated account APIs; no external transactions are performed. Captures
cover desktop, 390px and 320px phones, landscape, the tier lineup and actual 3D
inspection. Production gameplay tests continue to exercise startup, pause,
camera, real touch controls and vehicle input. Physical Android hardware testing
is a separate validation boundary, not implied by browser or signing checks.
