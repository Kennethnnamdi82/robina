# Movement and weapon continuity

## Authority is unchanged

The server still simulates movement/collisions at 60 fixed ticks per second,
publishes snapshots at up to 10 Hz and accepts input packets at up to 20 Hz
from the normal client. Health, death, cooldowns, ammo, inventory, extraction
and rewards remain server-owned. No new services or database writes were added.

The optional input `tick` is a prediction label, **not elapsed time**. It cannot
advance the server clock, grant travel, or claim a position or result. Strict
input validation and existing session authorization/rate limits remain enabled.

## Ordered movement stream (pullback repair)

New servers advertise `prediction.stream.version = 1`. The client records every
60 Hz movement step and sends the complete pending batch after the render frame's
physics work, at most once per 50 ms. A slow frame no longer sends only its first
step and discards the rest. Batches carry movement only; firing, reload,
interaction, damage, inventory and mission settlement retain their existing path.

The server consumes one ordered movement command per authoritative fixed step.
Its acknowledgement identifies the exact consumed tick, rather than inferring a
tick from the newest packet label plus a held-input count. A small initial input
cushion absorbs the send cadence and slow frames. Local prediction stays immediate.
Missing commands hold locomotion without repeating jump/dodge edges; late and
duplicate ticks are ignored. Each queue is bounded to 120 ticks and each packet
to 24 movement frames / 8 KiB. Client ticks cannot allocate simulation time.

Pause, stale input, and successful vehicle transitions invalidate the movement
generation. The client discards the old generation's history and queued packets.
Car collision boxes refresh immediately after a snapshot, before movement replay,
instead of waiting until rendering. Physics no longer uses the previous frame's
car positions during reconciliation.

The server retains elapsed time through ordinary scheduling stalls and drains it
in slices of at most six fixed steps, yielding to socket processing between
slices. More than one second of simulation debt triggers the existing pause and
resume flow. The client also pauses prediction after a one-second snapshot
outage. These bounds prevent unbounded catch-up or endless slow-motion correction;
they cannot make an overloaded server or a frozen browser render smoothly.

## Reconciliation

Snapshots include the exact stream acknowledgement, movement-controller state
and jump state. The older label/held-step fields remain for installed legacy
clients. Receiving a packet alone does not acknowledge unsimulated movement.

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

- `MovementNetwork.test.ts`: actual transport, controller, runtime movement,
  server simulation and bounded scheduler at 8/15/30/60/120 FPS, 0/200/400 ms RTT,
  variable frames, ordered delivery jitter, 250 ms server stalls, turns, walls,
  jumping, dodging and stopping. Compares with an independent offline motion
  reference; steady walking/running must have no backward frames, no recurring
  correction, and the expected speed. Deliberate backward dodges must match the
  reference exactly.
- `MovementStream.test.ts`, `missionAuthority.test.ts`: generation resets,
  batching, edge preservation, stale/duplicate/future input and outage recovery.
- `backend/test/simulationClock.test.js`, `backend/test/liveMissions.test.js`:
  real socket validation, fixed-step time accounting, bounded catch-up and long
  outage recovery without changing health or settling a mission.

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

## Rollout

Deploy the backend built with `npm run build:missions` before the frontend.
New clients negotiate the stream; old clients and servers retain their existing
protocol during rollout. Checkpoint version stays 3 because persistent mission
state is unchanged. Deploy both components to activate the full repair.

Android bundles the frontend locally. Run `npm run android:sync` and issue an
updated APK through the existing signed release workflow; publishing the website
alone cannot update already installed apps. Existing old APKs remain compatible
but do not gain the new movement batching until updated. No production deployment
or public APK publication is performed by the movement tests.
