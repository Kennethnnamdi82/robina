# Street corrections and readable command interface

## Navigation

The GPS now keeps a stable, line-of-sight-checked corridor instead of replacing
the grid path every 650 ms. Passed waypoints are consumed on each simulation
update. Paths are simplified with the same clearance rules as navigation.
Camera changes do not invalidate the route. One road marker uses the interpolated
player position and shortest-angle damping. While driving it sits beyond the
bonnet, rather than underneath the car. The HUD bearing unwraps ±180 degrees to
avoid full-turn CSS animation when crossing that boundary.

## Vehicles

Physical SAT contacts now report crash events. Closing speed includes a struck
vehicle's velocity. Parking nudges do not ignite cars; impacts at 7 m/s or above
ignite both involved vehicles and start a 4.5-second escape window. More severe
damage can destroy a vehicle immediately. Every destruction emits one explosion,
uses existing blast/fire/smoke effects and plays spatial crash/explosion audio.
Fire damages a remaining occupant; detonation kills a trapped occupant. Exiting
before detonation stops occupant damage, although standing next to the explosion
is still dangerous. Destroyed vehicles remain physical wrecks.

Mounted movement no longer contributes footstep distance, walking gait, shooting
sway or side-camera walking look-ahead. Car art and follow camera share the same
interpolated position; steering has render-only yaw smoothing. The motor uses a
generated harmonic engine voice with throttle/rev response and tire noise. All
vehicle audio obeys existing volume, mute and pause settings; no dependency or
sound-library download was added.

## Response and mission flow

Stealing a valuable starts persistent vehicular pursuit. Live response cars no
longer abandon it after the old 7/45-second escape timeouts. Passengers fire real
swept projectiles from the facing side window. Only the originating car is
excluded from that bullet's collision check; walls, cover and other cars block
it. Civilian traffic is damageable cover rather than sharing police immunity.
Site guards receive a faster 3D-only response profile; classic enemy balance is
unchanged.

Because police now pursue until extraction, the campaign escape objective is
"Reach extraction under pursuit". Entering the extraction approach completes that
stage; interacting with the actual delivery point still requires the valuable
and any existing witness/cargo-vehicle requirements. Successful extraction ends
the response. No reward/account/backend mechanics were added.

## Public UI

Menus use larger type and brighter secondary copy. Leaderboard numbers are 18px;
rank and operative columns stay pinned while additional columns scroll. The
existing high-contrast setting applies to menus as well as the HUD. Decorative
heading full stops and repeated developer/backend notices are removed. Loading
copy describes entering the city rather than internal asset preparation.

Unavailable products remain clearly marked coming soon. Public checkout has no
working confirmation or sample success selector. Recovery shows planned options,
not a fake current defeat/countdown. Full purchase/recovery state studies remain
available only to explicit component review fixtures. No paid ownership is faked.

## Verification scope

Regression tests cover waypoint advancement/clearance, camera-independent marker
heading, angle wrap, two-car impact, fuse, safe exit, occupant death, continuing
pursuit, car-window fire and physical bullet cover. Browser checks cover mobile
control separation, fire/audio rendering, store layouts and real model inspection.
Compiled-app checks additionally exercise actual driving, no mounted footsteps,
bank case pickup, active pursuit and normal 3D draw/pause/exit behavior. Readability
checks measure rank font size/contrast and horizontal layout at 320–1440px.

Physical-phone FPS and subjective audio quality still need device testing. These
changes do not claim photorealistic replacement assets or universal frame rates.
