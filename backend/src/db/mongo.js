import mongoose from 'mongoose';
import { env } from '../config/env.js';

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);
mongoose.set('maxTimeMS', 5000);

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
