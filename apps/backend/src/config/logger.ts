import pino, { type Logger } from 'pino';
import { loadEnv } from './env';

let cached: Logger | null = null;

export function getLogger(name?: string): Logger {
  if (!cached) {
    const env = loadEnv();
    cached = pino({
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
          : undefined,
    });
  }
  return name ? cached.child({ module: name }) : cached;
}
