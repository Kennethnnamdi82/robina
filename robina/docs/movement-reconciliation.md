# Movement and weapon continuity

## Authority is unchanged

The server still simulates movement/collisions at 60 fixed ticks per second,
publishes snapshots at up to 10 Hz and accepts input packets at up to 20 Hz
from the normal client. Health, death, cooldowns, ammo, inventory, extraction
and rewards remain server-owned. No new services or database writes were added.

The optional input `tick` is a prediction label, **not elapsed time**. It cannot
advance the server clock, grant travel, or claim a position or result. Strict
input validation and existing session authorization/rate limits remain enabled.

## Reconciliation

Snapshots include the label of the last input actually simulated, how many
fixed ticks it was held, movement-controller state and jump state. Receiving a
packet alone does not acknowledge movement that has not happened yet.

The client restores that movement state and replays only the newer locally
recorded movement steps. It retains at most 120 fixed steps (two seconds).
Replay never repeats shots, pickups, collision damage, sounds or mission events.
Driving restores authoritative car motion before replaying steering/acceleration.
Residual position differences are eased through the existing presentation layer;
the player, driven car and camera use the same displayed position.

Death/terminal states, vehicle entry/exit, checkpoint restoration and expired
history discard inappropriate pending motion. Pausing clears the replay history.
Large authoritative relocations still take effect rather than concealing an
invalid position indefinitely. During rollout, new clients omit tick labels
until the backend advertises support; older installed apps remain compatible.

## Animation and steering

Skin, weapon and camera presentation share render time instead of advancing
the skin only when a physics step runs. The operative starts facing the same
direction as the controller. Visual turns have an angular-speed limit, including
full reversals; this does not delay targeting or alter authoritative hit rays.

Rifles and SMGs retain a continuous ready source pose instead of switching to
pistol shot/reload arm clips. The two-hand rig provides recoil and the support
hand's magazine/reload motion. The grip follows the animated chest with a short
character-local filter, and adapts to the actual support arm's reach. The gun
remains attached to the real firing-hand socket. This is procedural rifle
presentation, not a claim that new authored motion-capture assets were added.

Directional touch driving now respects a speed/vehicle-dependent turn limit
instead of its former 6-radian/second heading shortcut.

## Verification

- `MovementPrediction.test.ts`: delayed/jittery snapshots, actual walking and
  vehicle physics, all four camera views, bounded history, acknowledgement order
  and preservation of health.
- `HumanoidAnimator.test.ts`: starting orientation, bounded reversals, continuous
  rifle poses and existing animation lifecycle rules.
- `tests/rivals3d/motion-grip.spec.ts`: actual military and universal GLBs in
  Chrome/WebGL; grip contact and weapon displacement through locomotion, fire
  and reload. Diagnostic captures go to ignored Playwright output.
- `tests/mission-authority/live.spec.ts`: real Three.js/Express/socket/MongoDB
  integration, walking, vehicle entry/driving, verified death/cooldown and
  verified extraction. The fixture uses only a temporary local database.
- `backend/test/cinematicMissions.test.js`: arbitrary prediction labels do not
  grant extra simulation time; trusted checkpoint restoration resets labels.

These checks do not substitute for a physical-phone playtest or promise a
particular frame rate on every device. Rendering throughput and connectivity
still determine how frequently new frames can be displayed.
