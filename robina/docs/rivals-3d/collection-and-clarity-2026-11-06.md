# Collection and gameplay clarity — 6 November 2026

## Delivered changes

- Removed the opaque objective compass card — the small transparent bearing and distance cue stays above the central player area
- Kept the existing world-space road triangle and collision-aware route planning, including camera-independent route state
- Restored source arm rotations before every animation evaluation so a clamped aiming clip cannot accumulate prior-frame IK
- Added an across-chest, two-hand ready stance that does not aim back through the torso when the camera observes an idle player
- Preserved the movement controller, player identity, existing animation clips and first-person equipment behavior
- Added pursuit reinforcements after valuable theft, three-shot window bursts, vehicle-speed-aware leading and advancing ground officers
- Retained physical cover, vehicle collisions, bounded reinforcement counts and normal extraction ending the pursuit
- Corrected compact HUD sizing, joystick-label hitbox overflow, portrait camera/radar overlap and landscape vitals/objective overlap

## Collection assets and presentation

The store now uses dedicated uniform exports rather than the same base-operative picture for every item
Eight cosmetic uniforms plus the Founder uniform have distinct material finishes, insignia and headgear
Bundles show their included uniform: Urban, Shadow, Cyber and Commander

The more detailed supplied `Military_Male_03.glb` was selected instead of mixing low-poly characters with the realistic soldier
These are outfit variants of the supplied soldier, not claims of nine newly authored people
The original source asset is unchanged

`scripts/prepare-rivals-collection.mjs` prepares 22 private GLBs and 22 WebP photographs from local supplied assets
This script is manual tooling — it never runs during game startup or the production build
The source MP5, M4A1 and grenade are used directly; SCAR/support/elite presentations use the supplied OBJ platforms rather than claiming newly authored exact real-world weapon models
Seven rifle finishes have matching photographed and inspectable models

The manifest records source paths, file sizes and hashes
All 22 photographs total approximately 567 KB
Product grids load photographs, not live WebGL contexts
One private 3D inspector is loaded only when requested, and is disposed on close
The existing gameplay model downloads and original source packs are unchanged

The redesigned Exchange has larger photography and typography, distinct uniform details, responsive category navigation, inspectable reward showcases and matching bundle content
Missing-model cards were replaced with actual supplied-model previews, not hidden behind a false availability claim

## Authority boundaries

This remains frontend-only collection work
Browsing cannot charge money, create receipts, grant ownership, change mission balancing or equip paid items
Checkout remains disabled and clearly labeled in the public UI
Manual purchase/recovery state demonstrations remain limited to explicit local review fixtures
No backend was added, and the prior BaseDrop source cleanup remains intact
No Git push or deployment was performed

## Verification

- Full frontend/game suite: 354 tests across 54 files passed
- Application and tooling TypeScript checks passed
- Focused ESLint and whitespace checks passed
- Production build passed and includes all 22 prepared models and photographs
- Six source browser checks passed: responsive store, distinct outfits and real inspectors, hand-mounted weapon views, transparent guidance spacing, reference inspector cleanup and recovery layout
- Compiled production-app Exchange check passed with authentication mocked and zero transaction requests
- Actual HUD/radar and transparent guidance layout checks passed across 390×844, 320×568, 844×390 and 568×320 viewports, including touch-target bounds and overlap assertions
- Final full-city touch-input run completed its input assertions and wrote `mobile-controls.json`, but exceeded its 420-second budget during context cleanup; its overall result is failed, not passed
- That run used low graphics/reduced-resolution software WebGL, not a physical-phone FPS benchmark; real-device smoothness remains unverified

Visual QA artifacts are in `test-results/collection-v2-final`
Compact layout evidence is in `test-results/hud-layout-complete` and `test-results/mobile-final`
