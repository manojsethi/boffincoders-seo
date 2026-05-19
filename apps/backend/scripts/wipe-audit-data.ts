// Drop findings, issues, audit_runs, and pages collections.
// Phase A schema changed model fields; this resets local/dev state.
// Usage: pnpm -F @boffin/backend exec tsx scripts/wipe-audit-data.ts

import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';

async function main(): Promise<void> {
  const env = loadEnv();
  const mongoose = await connectMongo(env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('mongo db handle unavailable');

  const collections = [
    'findings',
    'issues',
    'audit_runs',
    'pages',
    'page_snapshots',
    'page_content',
    'page_raw',
    'internal_links',
  ];
  for (const name of collections) {
    try {
      const count = await db.collection(name).countDocuments();
      await db.collection(name).deleteMany({});
      // eslint-disable-next-line no-console
      console.log(`wiped ${name}: ${count} docs removed`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`skip ${name}: ${(err as Error).message}`);
    }
  }
  await disconnectMongo();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('wipe failed', err);
  process.exit(1);
});
