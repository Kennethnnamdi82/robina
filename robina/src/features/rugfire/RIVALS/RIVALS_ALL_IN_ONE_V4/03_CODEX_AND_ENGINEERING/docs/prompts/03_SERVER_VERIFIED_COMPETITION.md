# CODEX PHASE 3 — Fair asynchronous rival challenges

Create server-controlled session creation/expiration, deterministic mission and vault version, event log/replay capture, server-side objective verification and score computation, idempotent XP/shard awards, rate limiting, abusive-session detection and leaderboards. Implement challenge invitations and ghost replays; persist top scores per mission version.

No blind trusting client's final `score`, `XP`, currency, or completion flag. Show tests demonstrating that fabricated scores and replayed claims are rejected. Keep all legacy mining formulas, balances and routes entirely unchanged. Do not add realtime multiplayer or paid wagers at this phase.
