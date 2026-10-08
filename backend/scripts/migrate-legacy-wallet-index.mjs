import { env } from '../src/config/env.js';
import mongoose from 'mongoose';

// Review first: npm run migrate:legacy-wallet-index
// Apply once with a database backup: npm run migrate:legacy-wallet-index -- --apply
await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000, autoIndex: false });
try {
  const collection = mongoose.connection.collection('users');
  const indexes = await collection.indexes();
  const old = indexes.find(index => index.name === 'walletAddress_1');
  if (!old) console.log('Legacy walletAddress_1 index is absent. No change required.');
  else {
    if (Object.keys(old.key).length !== 1 || old.key.walletAddress !== 1) throw new Error('Legacy index has an unexpected definition');
    const walletUnique = indexes.some(index => index.unique && Object.keys(index.key).length === 1 && index.key.wallet === 1);
    if (!walletUnique) throw new Error('The required unique wallet index is missing. Stop and repair indexes before migration.');
    if (process.argv.includes('--apply')) {
      await collection.dropIndex('walletAddress_1');
      console.log('Removed the verified legacy walletAddress index. The unique wallet index remains.');
    } else console.log('Legacy index exists. Dry run only; use --apply after reviewing and backing up the database.');
  }
} finally { await mongoose.disconnect(); }
