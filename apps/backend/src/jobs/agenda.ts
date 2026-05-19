import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { loadEnv } from '../config/env';
import { getLogger } from '../config/logger';

const log = getLogger('agenda');

let instance: Agenda | null = null;

export function getAgenda(): Agenda {
  if (instance) return instance;
  const env = loadEnv();
  const backend = new MongoBackend({
    address: env.MONGODB_URI,
    collection: env.AGENDA_COLLECTION,
  });
  instance = new Agenda({
    backend,
    processEvery: env.AGENDA_PROCESS_EVERY,
    defaultLockLifetime: env.AGENDA_DEFAULT_LOCK_LIFETIME_MS,
  });
  instance.on('ready', () => log.info('agenda ready'));
  instance.on('error', (err: unknown) => log.error({ err }, 'agenda error'));
  instance.on('start', (job: { attrs: { name: string } }) => log.info({ name: job.attrs.name }, 'job started'));
  instance.on('success', (job: { attrs: { name: string } }) => log.info({ name: job.attrs.name }, 'job success'));
  instance.on('fail', (err: unknown, job: { attrs: { name: string } }) =>
    log.error({ err, name: job.attrs.name }, 'job failed'),
  );
  return instance;
}

export const JOB_NAMES = {
  runFirstCrawl: 'project.runFirstCrawl',
  runCrawl: 'project.runCrawl',
  runAudit: 'project.runAudit',
  runAIAnalysis: 'project.runAIAnalysis',
  generateReport: 'project.generateReport',
  syncGSC: 'project.syncGSC',
  syncGA4: 'project.syncGA4',
  syncCWV: 'project.syncCWV',
  verifyFixes: 'project.verifyFixes',
  monitorWeekly: 'project.monitorWeekly',
  monitorMonthly: 'project.monitorMonthly',
  renderRecrawl: 'project.renderRecrawl',
  // Schedule wrappers — one per schedule.type. Each dispatches to the underlying action job and
  // updates Schedule.lastRunAt/nextRunAt so the Monitoring UI reads truthful values.
  scheduleCrawl: 'project.scheduleCrawl',
  scheduleAudit: 'project.scheduleAudit',
  scheduleReport: 'project.scheduleReport',
  scheduleSync: 'project.scheduleSync',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
