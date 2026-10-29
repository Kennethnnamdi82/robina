# Playable client-only Phaser demo

`npm install && npm run dev`. Works as a standalone prototype independent of Rivals account, crypto and mining. Use this implementation as a game-loop sample, NOT a paid game or authoritative competitive session. The CSS/HUD supports Android touch controls. For launch, replace the simplified local checks with server-authoritative validation and a production React integration.

It uses an actual PNG 4×4 tile atlas, character spritesheets and Tiled JSON map; Vite dependencies are not vendored and must be installed. 3 other maps and boss sheets are provided as *assets* but not integrated into the demo scene yet.

**Notice:** The demo currently uses local browser time, health and score. No onchain interaction occurs, no actual NFT is minted, and no money changes hands.
