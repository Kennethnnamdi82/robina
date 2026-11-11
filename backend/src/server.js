import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectMongo } from './db/mongo.js';
import { createApp } from './app.js';
import { initializeBounties } from './bounties/models.js';

let server;
let stopping = false;
const app = createApp(() => !stopping && mongoose.connection.readyState === 1);

async function shutdown(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  console.log('[backend] draining ' + signal);
  const deadline = setTimeout(() => process.exit(1), 15000);
  deadline.unref();
  try {
    await Promise.all([
      server ? new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())) : Promise.resolve(),
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
  await initializeBounties();
  server = app.listen(env.port, () => console.log('[backend] port=' + env.port));
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
