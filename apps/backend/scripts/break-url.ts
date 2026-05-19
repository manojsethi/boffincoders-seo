import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { PageModel } from '../src/db';
import { Types } from 'mongoose';

const pid = process.argv[2];
if (!pid) { console.error('usage: break-url.ts <pageId>'); process.exit(1); }

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env.MONGODB_URI);
  const before = await PageModel.findById(pid).lean();
  console.log('before url:', before?.url, 'schemaSource:', before?.schemaSource);
  await PageModel.updateOne({ _id: new Types.ObjectId(pid) }, { $set: { url: 'https://example.invalid/timeout' } });
  console.log('updated to invalid host');
  await disconnectMongo();
}
main().catch(e => { console.error(e); process.exit(1); });
