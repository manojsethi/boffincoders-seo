import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { SiteConnectionModel } from '../src/db';
import { encryptTokens, TOKEN_ENCRYPTION_VERSION } from '../src/config/encryption';
import { Types } from 'mongoose';

async function main(): Promise<void> {
  const env = loadEnv(); await connectMongo(env.MONGODB_URI);
  const pid = new Types.ObjectId('6a0709794137001a448ea31c');
  const blob = encryptTokens({
    refreshToken: 'mock-refresh', accessToken: 'mock-access',
    accessTokenExpiresAt: new Date(Date.now()+3600_000).toISOString(),
    scope: 'webmasters.readonly', googleAccountEmail: 'analyst@example.test',
  });
  await SiteConnectionModel.updateOne(
    { projectId: pid, provider: 'gsc' },
    { $set: { projectId: pid, provider: 'gsc', status: 'setup', encryptedTokens: blob, tokenEncryptionVersion: TOKEN_ENCRYPTION_VERSION, googleAccountEmail: 'analyst@example.test', siteUrl: null, error: null } },
    { upsert: true },
  );
  console.log('gsc set to setup state');
  await disconnectMongo();
}
main().catch(e=>{console.error(e);process.exit(1);});
