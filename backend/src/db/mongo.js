import mongoose from 'mongoose';
import { env } from '../config/env.js';

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);
// With buffering disabled, Mongoose must not attempt collection/index work
// while modules are being imported, before connectMongo() has completed.
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);
mongoose.set('maxTimeMS', 5000);

export async function initializeMongoModels() {
  if (mongoose.connection.readyState !== 1) throw new Error('database_not_connected');
  for (const model of Object.values(mongoose.models)) {
    // Ensure even index-free collections exist before transactional writes.
    // Never drop collections or synchronize/delete existing indexes here.
    await model.createCollection();
    await model.createIndexes();
  }
}

export async function connectMongo() {
  let timer;
  try {
    await Promise.race([
      mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 15000,
        waitQueueTimeoutMS: 5000,
      }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('database_connection_timeout')), 8000); }),
    ]);
    console.log('[mongo] connected');
  } finally { clearTimeout(timer); }
}
