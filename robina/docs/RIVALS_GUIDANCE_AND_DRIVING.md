# Road guidance, analog driving and asset-detail update

## Player-visible changes

- Red ground-level chevrons follow the actual obstacle-aware route to the active objective. The guide updates for new objectives, extraction, moving convoy targets and vehicle navigation. A floating destination marker, red minimap route and camera-relative red triangle supplement the road guide.
- Road arrows render after opaque road geometry, with depth testing retained. A GPU pixel regression verifies both visibility over the road and occlusion behind real walls.
- Driving uses a single analog joystick: up accelerates, down reverses, and horizontal input steers proportionally. The old left/right arrow buttons are removed; the separate brake and safe exit remain.
- First/third-person right-stick input turns the camera and fires along its crosshair. The response curve preserves fine centre control and quick outer travel. Tactical/side views retain directional aiming. Releasing, cancelling, blurring, resizing or disabling a stick clears its owned input.

## Presentation and performance

- Restored the supplied car's 31,600-triangle exterior rather than the previously reduced 17,730-triangle version. Still ten batched rigid parts, six materials and four real wheel pivots. The matching gzip sidecar is regenerated.
- Automotive paint uses clear coat, separate reflective glass and richer paint colours; all traffic classes receive visible head/tail-light lenses.
- The existing operative rig retains its movement/combat clips, with a field-fabric material finish and an authored hairstyle from the supplied CC0 pack. Raw source packs are untouched.
- High uses full civilian geometry and original normal/roughness maps; lower presets retain clustered crowd geometry. Walking/running still use the supplied skeletal animation atlas and instancing.
- More directional outdoor light, less excessive utility-asset desaturation, and a restrained High colour grade in the existing output pass. No additional full-screen rendering pass or new dependency.

## Scope and verification limits

No backend, account/economy, mission progression, weapon-damage or player-physics redesign. Existing mission-device, pickup, vehicle, traffic and crowd interactions remain; this does not add universal destructibility or an interaction to every decorative prop.

The city still uses the existing supplied building/vehicle families. This is a concrete rendering/control upgrade, not a claim of photorealistic AAA art or console vehicle physics. Real Android/iPhone GPU performance and visual quality must still be tested on physical devices; desktop browser emulation is not a phone benchmark.

Before final publication: the 232-test RIVALS suite passed; final focused rendering/control/lifecycle tests and TypeScript checks were rerun. Browser verification includes real analog driving, aim/fire release, seven phone viewport layouts, High rendering, and an actual GPU road-visibility/occlusion check. Final deployment verification is reported in the handoff.
