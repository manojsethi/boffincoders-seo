import { loadEnv } from './config/env';
import { getLogger } from './config/logger';
import { connectMongo, disconnectMongo } from './db/connect';
import { getAgenda, registerJobs } from './jobs';
import { createServer } from './http/server';

const log = getLogger('main');

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env.MONGODB_URI);
  log.info('mongo connected');

  const agenda = getAgenda();
  registerJobs(agenda);
  await agenda.start();
  log.info('agenda started');

  const app = createServer();
  const server = app.listen(env.BACKEND_PORT, env.BACKEND_HOST, () => {
    log.info({ port: env.BACKEND_PORT, host: env.BACKEND_HOST }, 'http listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'shutting down');
    try {
      server.close();
      await agenda.stop();
      await disconnectMongo();
    } catch (err) {
      log.warn({ err }, 'shutdown error');
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error({ err }, 'fatal startup error');
  process.exit(1);
});
