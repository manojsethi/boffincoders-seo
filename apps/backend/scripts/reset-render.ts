import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { PageModel } from '../src/db';

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env.MONGODB_URI);
  // pick 3 pages with no raw schema and reset their renderedExtractedAt
  const pages = await PageModel.find({ rawSchema: { $size: 0 } }).limit(3);
  for (const p of pages) {
    await PageModel.updateOne(
      { _id: p._id },
      {
        $set: {
          schemaSource: 'not-verified',
          renderedSchema: [],
          renderedRecrawlReason: null,
        },
        $unset: { renderedExtractedAt: '' },
      },
    );
    console.log('reset', p.url);
  }
  await disconnectMongo();
}
main().catch(e => { console.error(e); process.exit(1); });
