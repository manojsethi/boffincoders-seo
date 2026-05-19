import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { SiteConnectionModel } from '../src/db';

async function main(): Promise<void> {
  const env = loadEnv(); await connectMongo(env.MONGODB_URI);
  const docs = await SiteConnectionModel.find({}).lean();
  for (const d of docs) {
    const keys = Object.keys(d as Record<string, unknown>).sort();
    console.log('provider=', d.provider, 'status=', d.status, 'keys=', keys);
    const hasPlain = ['refreshToken','accessToken','accessTokenExpiresAt'].filter(k => k in (d as Record<string, unknown>));
    if (hasPlain.length) console.log('  ⚠ plaintext fields still present:', hasPlain);
    if ('encryptedTokens' in (d as Record<string, unknown>)) console.log('  encryptedTokens present:', !!(d as any).encryptedTokens);
  }
  await disconnectMongo();
}
main().catch(e => { console.error(e); process.exit(1); });
