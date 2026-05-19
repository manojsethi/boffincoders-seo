import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { SiteConnectionModel } from '../src/db';

async function main(): Promise<void> {
  const env = loadEnv(); await connectMongo(env.MONGODB_URI);
  // Connections without encryptedTokens (e.g. seeded mocks) → mark disconnected.
  const r = await SiteConnectionModel.updateMany(
    { encryptedTokens: { $in: [null, ''] }, status: 'connected' },
    { $set: { status: 'disconnected' } },
  );
  console.log('disconnected', r.modifiedCount, 'stale mocks');
  await disconnectMongo();
}
main().catch(e => { console.error(e); process.exit(1); });
