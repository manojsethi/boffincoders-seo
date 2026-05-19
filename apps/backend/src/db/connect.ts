import mongoose from 'mongoose';

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectMongo(uri: string): Promise<typeof mongoose> {
  if (connectionPromise) return connectionPromise;
  mongoose.set('strictQuery', true);
  connectionPromise = mongoose.connect(uri, { autoIndex: true });
  return connectionPromise;
}

export async function disconnectMongo(): Promise<void> {
  if (!connectionPromise) return;
  await mongoose.disconnect();
  connectionPromise = null;
}
