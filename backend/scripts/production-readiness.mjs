import mongoose from 'mongoose';
process.env.NODE_ENV = 'production';
const deadline = setTimeout(() => { console.error('Read-only database readiness timed out.'); process.exit(1); }, 12000);

try {
  const { env } = await import('../src/config/env.js');
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 5000,
    autoIndex: false, autoCreate: false,
  });
  await mongoose.connection.db.command({ ping: 1 });
  const indexes = await mongoose.connection.collection('users').indexes();
  const walletUnique = indexes.some(index => index.unique && Object.keys(index.key).length === 1 && index.key.wallet === 1);
  const legacyWalletAddressIndex = indexes.some(index => index.name === 'walletAddress_1');
  console.log(JSON.stringify({ databaseReachable: true, walletUnique, legacyWalletAddressIndex }));
  if (!walletUnique) throw new Error('The required unique wallet index is missing');
  if (legacyWalletAddressIndex) throw new Error('Review the legacy wallet index migration before release');
  console.log('Read-only database readiness passed. No collections, records or indexes changed.');
} catch (error) {
  // Connection error text can include infrastructure details; keep the report limited.
  console.error('Read-only database readiness failed (' + error.name + ').');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); clearTimeout(deadline); }
