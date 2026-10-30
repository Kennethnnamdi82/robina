# RIVALS — Combined prompt 1 of 10 (original phases 3 + 4)

This phase extends the existing game on `/gaming`: cinematic menu, mission briefing, settings, live HUD, and a fixed-step character controller. It does not start a new project or implement the next combined prompt. Existing authentication, account routes and backend records remain in place. No database migration or historical-data write is part of this work.

## Run locally

From `robina/robina`:

~~~powershell
npm ci
npm run dev:rivals
~~~

Open **http://127.0.0.1:8082/tests/rivals/index.html**, choose **Play**, select an operative in the briefing, and **Start Mission**. This isolated QA entry uses the actual GamingPage and Phaser scene without requiring login. It is not the production authentication entry.

For the integrated site, run `npm run dev`, sign in normally, and open `/gaming`. Vite now reads the existing `src/.env` when no root environment file is configured. Root `.env`, `.env.local`, and mode-specific environment files retain precedence. Only `VITE_` public settings reach the client; the local environment file stays ignored and is not copied into source control. The public values were not printed into the handoff.

Production compilation:

~~~powershell
npm run typecheck
npm run build
~~~

The production configuration gate is retained. It validates the real API URL and public Privy/Reown IDs. The earlier phase's missing-configuration problem is resolved by recognizing the existing `src/.env` location.

## Interface and mission flow

- The main menu uses RIVALS branding, animated supplied V4 chamber art, a prominent Play/Continue action, missions, character customization, player profile, leaderboards preview, settings, and exit/back. Background framing crops out reference-only navigation/statistics. Tab/Enter and arrow/Home/End navigation work; reduced motion removes ambient menu animation.
- **Missions** opens a real local mission selector. Neon District / First Insertion is available. Phantom Fortress and Reactor Zone are clearly labeled unavailable future operations.
- The pre-mission briefing shows the configured description, Training difficulty, selected animated operative, actual unarmed loadout, no configured rewards, readiness, graphics preference, Start Mission and Back.
- **Character customization** selects VEX, NYX or ROOK for the next run. It shows the standard field suit and explicitly unavailable cosmetics/attachments. It does not invent owned skins, weapon inventory or entitlements.
- **Player Profile** links to the existing `/profile` route. RIVALS rankings are explicitly not live; the existing community leaderboard link goes to `/rank`. The local recon run submits no ranked score.
- **Return to Main Menu** suspends the current run in memory. **Continue** returns to that same run and canvas. Starting another mission, restarting, or exiting the game prompts before losing local run progress. Reloading the page ends the local run; no persistent mission-save service is claimed.
- The game occupies the viewport while active. The existing website bottom navigation is covered and made inert only during active play; attributes are restored when the menu returns or the page unmounts. Other website pages keep their navigation.

The current objective is **Activate the insertion uplink**. This uses the already interactive insertion hologram. Its first successful activation changes actual progress from 0/1 to 1/1. Deactivating it later does not undo the completed recon objective. No reward, mission score, combat encounter or extraction system is fabricated.

## Live HUD and settings

The HUD reads the current session: health and maximum health, unarmed/equipped-weapon state, optional shield/ammo fields, objective/progress, active field time, damage feedback, nearby equipment, pause, and dodge cooldown. Shield, ammo and extraction UI appear only if those systems provide real data; none is configured in this unarmed recon mission.

Health is an actual local controller value (100 maximum). No hostiles are added in this phase. A QA-only damage adapter exercises health loss, hurt/death state and feedback; it is not exposed by the production GamingPage route.

Settings apply immediately and persist under **`rivals_settings_v1`**. The previous graphics key is read as a compatibility default, not deleted. Selected operative uses **`rivals_operative_v1`**. No account/balance keys are written.

| Setting | Actual behavior |
| --- | --- |
| Master volume | Multiplies music and effects gain |
| Music volume | Controls optional looping supplied ambience |
| Sound effects volume | Controls supplied dodge, inspection and hit cues; test cue button available when unmuted |
| Mute | Stops audio; starts muted on a fresh settings profile |
| Graphics quality | Existing High/Balanced/Low effects and render-scale presets; no game recreation |
| Mobile controls | Automatic / Always show / Hide; clearing hidden touch intent prevents stuck motion |
| Motion | Device preference or explicit reduction; OS reduction is always honored |
| High contrast HUD | More opaque backgrounds, stronger borders and readable text |
| Damage camera shake | Optional subtle shake, disabled under reduced motion |
| Control help | Explains desktop bindings, both touch sticks, sprint and cooldown |

Optional audio uses a bounded HTMLAudio pool; it downloads only after playback is enabled/requested. Music, effects and preview gains are separate. Pause stops audio and explicit resume restarts permitted ambience. Playback-device/autoplay failure is caught so the game remains usable.

## Controls and movement

| Desktop | Action |
| --- | --- |
| WASD / arrows | Analog-normalized top-down movement |
| Shift | Hold to sprint |
| Space | Dodge in movement direction, or current aim/facing while stationary |
| Mouse over arena | Independent aim/facing and reticle |
| Left mouse | Fire intent, only usable when an actual weapon system is equipped |
| E | Buffered interaction with nearby equipment |
| Escape | Pause/resume; settings/dialogs handle their own close/back behavior |

Mobile uses a left movement stick and right aim stick, plus Sprint toggle, Dodge, contextual Interact and a clearly disabled **Unarmed** fire control. Movement/aim can be held together. Each stick owns its own pointer ID and handles cancellation/lost capture/unmount; another finger cannot reset it. The controls use safe-area-aware positions and separate portrait/landscape layouts. Important controls are at least 44 CSS pixels.

There is **no equipped weapon or shooting mechanic in this recon mission**. Fire input is centralized and the HUD/control is conditional; the UI does not pretend that shots, ammunition or combat damage exist.

Movement tuning is centralized in `characters/CharacterController.ts`:

- Walk 235 world units/second; sprint multiplier 1.55.
- Exponential time-based acceleration and stopping, with a small stop threshold.
- Combined keyboard/touch diagonals bounded to unit magnitude; analog stick magnitude retained.
- Dodge speed 620, duration 0.18 seconds, cooldown 1.1 seconds.
- Four-direction facing can follow aim independently of travel.
- Health/hurt/death and interaction locks prevent invalid movement/actions.
- Existing fixed 14-unit foot collider, wall/prop collisions and enclosed map remain.

The controller advances from Arcade Physics' **60 Hz WORLD_STEP** event rather than render-frame counts. Short Dodge/E presses are buffered until consumed. High dodge speed still uses 60 Hz collision steps. Camera follow uses bounded smoothing, device-sensitive zoom and world bounds; reduced motion snaps follow and disables camera shake/entry fade.

## Animation contracts

`AnimationStateMachine` resolves priority: death → hurt → dodge → interaction → attack intent → run/walk → aim → idle. Death is terminal for that controller; restart constructs a new controller. `CharacterAnimator` changes animation only when state/facing changes. Physics geometry never depends on sprite animation or breathing scale.

The existing integrated human atlases are reused; there is no new bitmap generation in this phase. Authored walking is available in four directions for all three operatives. Idle/aim/interaction/hurt/death use documented compatible stationary-pose fallbacks. Run/dodge use accelerated walking. Attack animation keys and state resolution are supported for a future weapon system, with a stationary fallback; no authored attack/shoot cycle or combat timing is claimed. Original V4 action art remains preserved but has incompatible proportions/style.

## Architecture and performance work

~~~text
GamingPage                         Menu/briefing/settings navigation and one active session
core/settings.ts                   Sanitized local preferences and reduced-motion resolution
core/session.ts                    Typed scene/UI bridge and shared input buffer
data/missions.ts                   Real local recon configuration (no fabricated rewards)
input/InputBuffer.ts               Bounded combined intent and buffered one-shot actions
input/InputManager.ts              Single DOM gameplay router, focus guards and cleanup
characters/CharacterController.ts  Fixed-step motion, dodge, health and transient locks
characters/AnimationStateMachine.ts Priority/terminal-state rules
characters/CharacterAnimator.ts    Existing cached directional frame presentation
audio/GameAudio.ts                 Optional bounded audio and gain/pause lifecycle
game/ArenaScene.ts                 Physics, environment, camera, state integration
ui/                               Menus, briefing, settings, live HUD, touch/action controls
~~~

Phaser is still deferred until a mission starts; menus do not initialize it. Only the selected operative and shared environment textures load for the arena. The menu preview reuses that selected compressed atlas. Existing V4 originals and Phase 02 textures remain intact.

Performance changes include selected-value UI subscriptions, static minimap geometry reuse, imperative throttled QA telemetry, joystick knob updates without React state changes per pointer move, reusable per-step command/state objects, fixed-step controller timing, and one gameplay input router. Unused Phaser keyboard/mouse/touch and WebAudio managers are disabled. Pausing sleeps the game loop; resume resets its delta clock so paused time is not simulated. Disposal wakes a sleeping loop only to complete Phaser's pending destruction.

Phaser can pool/reuse its canvas element after restart. A reused canvas is not evidence of a leaked game instance. Regression checks assert a changed run identity, reset state, one canvas, single-action behavior and listener cleanup.

See **[verification and performance](RIVALS_COMBINED_01_QA.md)** and **[screenshots](rivals-combined01/)** for measured results and their limits. No constant 60 FPS or physical Android guarantee is made from this test host.

## Files created / modified

Created runtime files:

- `core/settings.ts`, `data/missions.ts`.
- `input/InputBuffer.ts`, `input/InputManager.ts`.
- `characters/CharacterController.ts`, `characters/AnimationStateMachine.ts`.
- `audio/GameAudio.ts`.
- `ui/ControlHelp.tsx`, `OperativePreview.tsx`, `SettingsPanel.tsx`, `MissionLobby.tsx`, `MenuPages.tsx`, `ConfirmDialog.tsx`, `ArenaHUD.tsx`, `useArenaValue.ts`, `ActionControls.tsx`, `trapFocus.ts`.

Modified runtime files:

- `src/pages/GamingPage.tsx`.
- `core/contracts.ts`, `core/session.ts`, `core/presentation.ts`, `characters/definitions.ts`.
- `game/ArenaScene.ts`, `game/createGame.ts`, `world/EnvironmentLayer.ts`, `characters/CharacterAnimator.ts`.
- `ui/Lobby.tsx`, `ArenaView.tsx`, `TouchStick.tsx`, `MiniMap.tsx`, `rivals.css`.
- `vite.config.ts`: recognizes existing local public environment-file location; authentication/data services are not rewritten.
- Four supplied optional WAV cues plus provenance manifest in `public/assets/rivals/controls/`.

Tooling / tests / documentation:

- `scripts/prepare-rivals-assets.mjs` reproduces the four optional audio exports alongside preserved curated V4 assets.
- `scripts/benchmark-rivals.mjs` follows the new menu/briefing flow; `--combined01` saves results separately from Phase 02.
- New `core/settings.test.ts`, `characters/CharacterController.test.ts`, `input/InputManager.test.ts`, `audio/GameAudio.test.ts`.
- New `tests/rivals/helpers.ts`, `controller.spec.ts`, `interface.spec.ts`; updated `arena.spec.ts`, `visuals.spec.ts`, `harness.tsx`.
- This handoff, QA report and artifacts in `docs/rivals-combined01/`.

No backend source or dependency manifest was changed. Its existing lockfile dependencies were installed for validation. No new frontend dependency, account-data feature, marketplace, mining, NFT/payment flow or multiplayer feature is introduced.

## Next-phase handoff

Do not assume combat, weapon inventory, shields, extraction, ranked scoring, a persistent mission service or cosmetics are complete. The current mission deliberately configures those as absent. A later weapon system should own ammunition/projectiles/hit validation and provide real HUD state and animation intent. It must not infer shots from a decorative button.

Keep input capture in `InputManager`, movement rules in `CharacterController`, collision in Phaser, and presentation in `CharacterAnimator`. Preserve fixed-step timing, buffered one-shot actions, focus guards, per-stick pointer ownership and explicit cleanup. Replace visual fallback clips with compatible authored art before calling them final action animations.

Health and the local objective are session state only. Server-authoritative progression/rewards/network combat must use the existing application services in their authorized phase; do not write historical balances from this local session.

QA-only damage testing is available at the isolated entry with `?validation=1`. It invokes the same controller damage path used by the HUD and locks movement after death. The production route never passes the validation prop. This is validation tooling, not an enemy/combat feature.
