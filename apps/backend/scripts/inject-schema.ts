import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { PageModel } from '../src/db';
import { Types } from 'mongoose';

const pid = process.argv[2];
async function main(): Promise<void> {
  const env = loadEnv(); await connectMongo(env.MONGODB_URI);
  const fake = [{ '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact us' }];
  await PageModel.updateOne(
    { _id: new Types.ObjectId(pid) },
    {
      $set: {
        rawSchema: fake,
        schema: fake,
        schemaTypes: ['ContactPage'],
        schemaSource: 'raw-html',
        schemaParseErrors: [],
        renderedSchema: [],
        renderedExtractedAt: null,
        renderedRecrawlReason: null,
      },
    },
  );
  console.log('injected ContactPage schema on', pid);
  await disconnectMongo();
}
main().catch(e=>{console.error(e);process.exit(1);});
