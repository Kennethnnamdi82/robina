# Proposed architecture & Render deployment (no paid worker needed for Socket.IO)

## Minimum launch architecture
Vercel React + Phaser client -> existing Render Node/Express web service -> MongoDB. Attach Socket.IO to the **same** Node HTTP server if adding live notifications/raid progress. Socket.IO does not itself require a paid worker or Redis when running a single server instance. The game can start asynchronous, so it doesn't need Socket.IO at all for phase one.

## What needs extra services later?
Redis or a managed equivalent is useful for presence, cross-instance pub/sub, caching, distributed jobs and rate limits. A separate worker service is optional for scheduled jobs/queue processing, heavy NFT indexing, tournament finalization and notification batches. Run low-volume jobs in a controlled in-process loop initially only if you accept restarts and at-least-once semantics; do not do high-value payments in volatile in-memory queues.

## Security & infra
- Render Free can sleep, restart and have cold starts; not a reliable host for always-on low-latency realtime PvP.
- `app.listen()` can attach both Express and Socket.IO through `http.createServer(app)`; the CORS origins must be restricted.
- Use secure wallet auth, CSRF as appropriate, exact transaction verification and idempotent orders.
- `mining/` routes/models/events remain unchanged; new game modules are isolated.
- Never grant XP, NFTs or money from browser-submitted score.

## Minimal Socket.IO attachment pseudocode

```ts
import { createServer } from 'node:http';
import { Server } from 'socket.io';
const server = createServer(app);
const io = new Server(server, { cors: { origin: process.env.FRONTEND_URL } });
io.on('connection', socket => { /* verified auth in middleware first */ });
server.listen(process.env.PORT || 5000, '0.0.0.0');
```

**Production change:** authenticate WebSocket handshake; authorize each room subscription; validate each event and limit payload sizes.
