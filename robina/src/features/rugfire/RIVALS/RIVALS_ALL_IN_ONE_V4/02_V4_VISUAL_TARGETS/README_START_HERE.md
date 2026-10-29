# RIVALS V4 — REFERENCE-FAITHFUL VISUAL UPGRADE

This package takes the **exact image supplied in the conversation** as the non-negotiable visual target and adds a visually upgraded running V3 prototype.

## Folders
- `visual_reference/`: eight exact crops from the supplied concept plus original full reference. These are **visual targets**, not game sprite sheets.
- `visual_showroom/index.html`: responsive visual review site; opens the full-resolution reference panels and links to the playable prototype.
- `playable_game/`: the V3 playable single-player prototype with three new, more detailed 4×4 neon tile atlases (64px tiles), additional gameplay light pools, revised UI, and a new visual world map tab.
- `CODEX_VISUAL_DIRECTIVE.md`: precise visual matching requirements, which must be followed before claiming release-grade visual fidelity.

## How to test (locally)
From inside this kit run `python -m http.server 8000`, then visit `http://localhost:8000/visual_showroom/` and `http://localhost:8000/playable_game/`.

## Honest limitation
The master reference is a flattened montage, not 2D animation source. Its characters, floors, buildings, effects, and buttons cannot be extracted as full, clean, independently animated game assets. What is delivered now: visual targets, richer usable tile atlases, a playable upgraded prototype, and a precise integration guide. Pixel-perfect interactive reconstruction needs independent illustrations, sprite sheets, and carefully rendered backgrounds. This package does not promise exact visual identity or 10/10 gameplay.

No existing BaseDrop mining logic, user balances, or production app files are included or changed. This is a separate local demo and visual package.
