# RIVALS Prompt 02 — visual comparison

This review compares the actual minified browser build against the supplied `02_V4_VISUAL_TARGETS/visual_showroom/03_exploration_gameplay.png` and the broader supplied reference sheet. The original target is a flattened cinematic illustration. The implemented arena is a live tile-based scene with movement, collision, animated operatives, local equipment interaction, and pause/resume.

**The current result does not match the reference exactly and is not a verified 10/10 commercial finish.** This phase establishes coherent playable art and reusable systems. It does not deliver the reference's combat, traps, bosses, missions, equipment progression, or final art polish.

## Actual browser captures

- [Lobby, desktop](rivals-phase02/lobby-desktop.png)
- [Arena, desktop insertion position](rivals-phase02/arena-desktop.png)
- [Arena, desktop after movement / nearby equipment](rivals-phase02/desktop-high.png)
- [Mobile Balanced, NYX, left stick and right Inspect](rivals-phase02/mobile-balanced.png)
- [Mobile Low, ROOK](rivals-phase02/mobile-low.png)
- [VEX](rivals-phase02/vex-operative.png), [NYX](rivals-phase02/nyx-operative.png), [ROOK](rivals-phase02/rook-operative.png)
- [Low](rivals-phase02/low-quality.png), [Balanced](rivals-phase02/balanced-quality.png), [High](rivals-phase02/high-quality.png) with reduced motion enabled in the quality-switch test.

These are screenshots captured from the application, not generated pictures of a proposed UI. The concept illustration in the lobby is retained and labeled chamber art; it is not the playable scene.

## Comparison

| Area | Implemented behavior and appearance | Remaining difference |
| --- | --- | --- |
| Character appearance | Three distinct detailed human operatives, dark tactical armor, purple/amber character accents, independent transparent directional frames, fixed foot pivot and blue selection ring. | The supplied exploration target uses an exaggerated chibi silhouette. This phase follows the prompt's more realistic human direction. Faces, cloth, hands and pose-to-pose anatomy still need human art/animation polish. No matching final weapon/action art yet. |
| Environment richness | Individually placed painted metal wall sections, floor panels/grates/thresholds, crates, consoles, scanners, light pylons, pipes, sealed vault and reactor. Walkable floor remains legible. | Rooms use a repeated modular kit and the existing training layout. The target has more bespoke rubble, trim, broken masonry, variations and tightly composed encounters. Additional corner/end-cap orientation art and district-specific materials would improve architectural variety. |
| Camera perspective | Orthographic 2.5D sprites over a top-down collision map. Depth follows feet; props/walls can occlude the operative. Camera tracks movement and responds to viewport changes. | Generated assets have small perspective inconsistencies. Some wall joins repeat or expose seams. A final production kit should be drawn to one agreed perspective and tile metrics. |
| Lighting | Controlled cyan/violet/amber pools, player aura, soft contact shadows, pulsing equipment lights and a screen vignette. The player shadow shifts subtly relative to a nearby light. | The target has stronger authored pools, emissive edges and richer light/shadow interaction. Current Canvas light textures do not cast occluded shadows, illuminate normal maps or provide real bloom. |
| Animation consistency | VEX/NYX/ROOK change facing, cycle actual walking frames and return to stationary pose. Shared pivots and fixed collision geometry prevent animation scaling from moving the body. | Walking loops need an animator's cleanup; cloth and silhouettes vary between generated poses. Dedicated idle/run/dash/attack/hit/defeat cycles are missing and explicitly use fallbacks. |
| Visual effects | Animated scanner cones, bounded dust, light pulse, interaction emphasis, entry fade and operative ground ring. Presets and reduced motion control effects. | Reference effects include combat beams, energy attacks, impact flashes and boss projectiles. Those belong to later gameplay phases and are intentionally absent. No claim of final combat VFX. |
| Gameplay readability | Open floor contrasts with solid cover/walls. Inspectable equipment has a proximity highlight, named prompt and working right-side action. The minimap reflects the actual layout/player position. Mobile has a left movement stick. | Mobile viewport shows less surrounding space. Physical Android testing is still needed. Future weapon controls must be designed around real combat; this phase does not display decorative weapon buttons or fake health/mission state. |
| Overall cohesion | New characters, machinery, floor and wall art share dark industrial materials and controlled accent colors. All artwork is loaded through stable compressed atlases. | The existing lobby chamber illustration retains the original chibi direction, while playable characters follow the prompt's human direction. A matching human lobby hero render, bespoke scene dressing, authored lighting and final animation would unify the presentation further. |

## Assets still needed

1. Production animation passes for all three operatives: dedicated directional idle, run, dash, attacks, hurt and defeat, with consistent anatomy, cloth, timing and foot contact. Combat/weapon action art should follow the next authorized mechanics rather than be invented here.
2. A final modular architecture kit with correctly oriented corner/junction/end pieces, doorway transitions and consistent perspective. More subtle floor variants and room-edge detailing would reduce visible repetition.
3. Matching human operative lobby renders and portrait art to replace the older chibi concept presentation when approved.
4. Art-directed lighting assets, emissive masks/normal maps if a measured WebGL path is adopted, and true occlusion/shadow treatment for the desired final cinematic finish.
5. Future district-specific art and layouts for Phantom Fortress and Reactor Zone. Theme data exists, but those scenes are not implemented or loaded.
6. In later authorized phases: weapon sprites, impact/ability effects, enemy/boss animation, mission-specific objects and environmental hazard art. The current original pack contains stylized source material for evaluation, not a claim of completed matching new art.

## Performance limits affect visual sign-off

The benchmark records approximately 9.7 FPS on the 1440×1000 High scenario and 28–32 FPS in throttled mobile-sized scenarios on this test host. These measurements do not establish smooth commercial performance on desktop or physical Android devices. The desktop result is below target and requires profiling on a representative hardware-accelerated browser before visual production sign-off. Preserve the measured results instead of presenting the reference as an achieved performance/quality guarantee.

See [QA and measurement details](RIVALS_PROMPT_02_QA.md) and [the technical handoff](RIVALS_PROMPT_02.md).
