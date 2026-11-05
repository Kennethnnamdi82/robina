# Control, pursuit and feedback refinement

This follow-up addresses reported movement drag, low TPS camera positions,
Collect entering cars, overpopulated road guidance and difficult driving.

## Changes

- TPS orbit pitch is bounded and both perspective eyes stay at least 0.42 m
  above the ground, including collision recovery and wide zoom.
- The 3D operative accelerates/stops more decisively. Nonlethal damage no
  longer repeatedly stops translation; the classic controller keeps its stun.
  Walk/run cadence uses distance-based stride lengths. Skinning/mixer and arm
  posing advance once per displayed frame, not every fixed simulation substep.
- Slow-frame simulation uses bounded 30 Hz swept physics below 12 FPS, keeping
  movement/game time consistent down to 5 FPS with at most six catch-up steps.
  This is not a claim that rendering runs at 60 FPS on all phones.
- Right-stick gun-only aiming is retained. Player bullets travel at 130 m/s
  (pistol) or 240 m/s (rifle/SMG), retaining swept collision and wall blocking.
- One near-player red road arrow replaces the trail and floating destination
  cone. The minimap and screen bearing remain available.
- Point the driving stick to turn/accelerate in screen space; pull back for
  reverse. Release auto-brakes. Pedals, keyboard controls and collision remain.
- Collect never enters a vehicle. Entry/exit use their explicit button/F key.
- Valuable pickup switches police into a mobile cargo pursuit. The lead car
  continues after deploying support, predicts a short interception, and backs
  out of obstructions. Police use longer-range swept shots, short lead aim,
  lateral firing movement and actual occluding cover. Cars do not teleport.
- Grenades add temporary ground aftermath, irregular warm flames, embers and
  larger drifting smoke. Sustained fires remain bounded and use three instanced
  draws, with lower simultaneous-fire budgets on Low/Medium.
- The 3D ambient music loop is replaced by an original generated stereo heist
  score (112 BPM), with a pursuit layer and gunfire ducking. Existing music,
  effect, mute and pause settings remain respected; no music downloads added.

## Verification scope

Regression tests cover camera ground clearance, control response, frame-rate
independent game time, direct steering/reverse/release, Collect priority, moving
police after pickup, waveform headroom and deterministic composition. Browser
fixtures compile the effects shaders, render the single occluded arrow and
small-phone controls, and render the score through Web Audio. Production tests
exercise actual CDP joystick touches, pedals, gun aim, grenade aftermath and a
real bank walkthrough. No authentication/payment/account mutations are needed.

This is refinement of the existing supplied 3D artwork, not new AAA character
assets, a Call of Duty engine replacement, structural destruction, or certified
physical-phone performance. Existing task notes, raw asset packs and user art
reports are not part of this change.
