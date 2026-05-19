import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { PageModel } from '../src/db';
import { Types } from 'mongoose';
async function main(): Promise<void> {
  const env = loadEnv(); await connectMongo(env.MONGODB_URI);
  await PageModel.updateOne(
    { _id: new Types.ObjectId('6a07d9119bbc320471bbe8da') },
    { $set: { url: 'https://boffincoders.com/services/ai-automation' } },
  );
  console.log('restored');
  await disconnectMongo();
}
main().catch(e=>{console.error(e);process.exit(1);});
