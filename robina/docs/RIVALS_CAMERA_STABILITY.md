# Camera flashes / gameplay HUD fix — 3 November 2026

- Removed the gameplay GRAPHICS shortcut and its CSS. Low/Medium/High remain available on the start screen and in the pause menu; the start-screen help text now points to the pause menu.
- Found a frame-clearing defect: `RaidRuntime` drew the world, then adaptive resolution called `setPixelRatio`/`setSize`. Writing canvas dimensions clears the drawing buffer. TPS could show an empty frame; FPS could show only its weapon overlay. Several initial quality adjustments made this look like on/off blinking until resolution settled.
- Added `FrameSurface` to commit changed canvas dimensions, postprocessing dimensions and projection before any drawing. Duplicate resize notifications do not rewrite dimensions. Resize observers and quality changes now request a frame rather than clearing the canvas between frames. World and weapon rendering finish together with no subsequent resize.
- The loading overlay now remains until the first complete world frame has been drawn. Cancellation/disposal releases the first-frame wait safely.
- Movement, player assets, intended shooting recoil and graphics choices are unchanged.

Verification:

- 16 focused unit tests passed (frame presentation, duplicate/hidden layouts, adaptive overload/recovery, graphics choices, camera feedback and rigid render batching).
- `scripts/verify-camera-stability.mjs` audits actual game-canvas dimension writes against default-framebuffer draws, forces two adaptive scale changes, checks that world rendering precedes the playing UI, confirms the graphics shortcut is absent, and verifies graphics remain in the pause menu. Uses the exact Vite runtime module URL, including any HMR timestamp.
- `scripts/verify-city-presets.mjs` now expects a clean gameplay HUD and opens graphics through the normal pause button.
- Actual browser audit passed: 211 world draws before the playing UI, six canvas dimension writes across initial sizing and two forced resolution changes, zero clears after drawing, and zero browser errors. The gameplay graphics button was absent; pause-menu selection remained available.
- Whole-project type checking still reports the eight pre-existing first-person weapon API errors; no additional diagnostics appeared from this fix.

The browser audit is written to `docs/rivals-3d/art-direction/camera-stability-audit.json`. It is a local rendering-order regression, not a physical-phone FPS benchmark.
