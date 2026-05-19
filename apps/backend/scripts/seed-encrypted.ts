import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { SiteConnectionModel } from '../src/db';
import { encryptTokens, TOKEN_ENCRYPTION_VERSION } from '../src/config/encryption';
import { Types } from 'mongoose';

async function main(): Promise<void> {
  const env = loadEnv(); await connectMongo(env.MONGODB_URI);
  const pid = new Types.ObjectId('6a0709794137001a448ea31c');
  for (const provider of ['gsc','ga4'] as const) {
    const blob = encryptTokens({
      refreshToken: `mock-refresh-${provider}`,
      accessToken: `mock-access-${provider}`,
      accessTokenExpiresAt: new Date(Date.now()+3600_000).toISOString(),
      scope: provider==='gsc'?'webmasters.readonly':'analytics.readonly',
      googleAccountEmail: `${provider}@example.test`,
    });
    await SiteConnectionModel.updateOne(
      { projectId: pid, provider },
      { $set: {
        projectId: pid, provider,
        encryptedTokens: blob,
        tokenEncryptionVersion: TOKEN_ENCRYPTION_VERSION,
        googleAccountEmail: `${provider}@example.test`,
        status: 'connected',
        siteUrl: provider==='gsc'?'https://boffincoders.com/':undefined,
        ga4PropertyId: provider==='ga4'?'0000-mock':undefined,
      } }, { upsert: true },
    );
  }
  console.log('seeded encrypted gsc + ga4');
  await disconnectMongo();
}
main().catch(e=>{console.error(e);process.exit(1);});
