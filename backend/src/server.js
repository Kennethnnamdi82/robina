import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectMongo, initializeMongoModels } from './db/mongo.js';
import { createApp } from './app.js';
import { initializeBounties } from './bounties/models.js';
import { LiveMissionAuthority } from './missions/liveAuthority.js';
import './missions/models.js';

let server;
let stopping = false;
const missionAuthority = new LiveMissionAuthority({ origins: env.corsOrigins,
  maxSessions: process.env.MISSION_MAX_ACTIVE_SESSIONS || 4,
  publicOrigin: process.env.MISSION_SOCKET_ORIGIN || process.env.RENDER_EXTERNAL_URL || '' });
const app = createApp(() => !stopping && mongoose.connection.readyState === 1, { missionAuthority });

async function shutdown(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  console.log('[backend] draining ' + signal);
  const deadline = setTimeout(() => process.exit(1), 15000);
  deadline.unref();
  try {
    await missionAuthority.close();
    await Promise.all([
      server?.listening ? new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())) : Promise.resolve(),
    ]);
    await mongoose.disconnect();
    clearTimeout(deadline);
    process.exit(exitCode);
  } catch (error) {
    console.error('[shutdown]', error);
    process.exit(1);
  }
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

async function start() {
  await connectMongo();
  console.log('[startup] preparing collections and indexes');
  await initializeMongoModels();
  console.log('[startup] collections and indexes ready');
  await initializeBounties();
  console.log('[startup] bounty accounting ready');
  server = app.listen(env.port, () => console.log('[backend] port=' + env.port));
  missionAuthority.attach(server);
  // Bound idle/request sockets and leave slow external services to their own deadlines.
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.on('error', error => { console.error('[listen]', error); void shutdown('listen error', 1); });
}
start().catch(error => {
  console.error('[startup]', error.message);
  process.exit(1);
});
