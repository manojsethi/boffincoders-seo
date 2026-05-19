import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import mongoose from 'mongoose';

async function main(): Promise<void> {
  const env = loadEnv(); await connectMongo(env.MONGODB_URI);
  const coll = mongoose.connection.db!.collection('site_connections');
  const r = await coll.updateMany(
    {},
    { $unset: { refreshToken: '', accessToken: '', accessTokenExpiresAt: '' } },
  );
  console.log('matched=', r.matchedCount, 'modified=', r.modifiedCount);
  await disconnectMongo();
}
main().catch(e => { console.error(e); process.exit(1); });
