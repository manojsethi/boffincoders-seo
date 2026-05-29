import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { loadEnv } from '../config/env';
import { getLogger } from '../config/logger';
import { projectsRouter } from './routes/projects';
import { runsRouter } from './routes/runs';
import { issuesRouter } from './routes/issues';
import { pagesRouter } from './routes/pages';
import { reportsRouter } from './routes/reports';
import { profileRouter } from './routes/profile';
import { schedulesRouter } from './routes/schedules';
import { workspaceRouter } from './routes/workspace';
import { renderRouter } from './routes/render';
import { integrationsRouter } from './routes/integrations';
import { goalsRouter } from './routes/goals';
import { keywordsRouter } from './routes/keywords';
import { opportunitiesRouter } from './routes/opportunities';
import { analyticsRouter } from './routes/analytics';
import { jobsRouter } from './routes/jobs';
import { recommendationsRouter } from './routes/recommendations';
import { keywordFitRouter } from './routes/keyword-fit';
import { maintenanceRouter } from './routes/maintenance';
import { aiRouter } from './routes/ai';
import { contentBriefsRouter } from './routes/content-briefs';
import { fixPlansRouter } from './routes/fix-plans';
import { auditRulesRouter } from './routes/audit-rules';
import { crawlScopeRouter } from './routes/crawl-scope';
import { onboardingRouter } from './routes/onboarding';

const log = getLogger('http');

export function createServer(): Express {
  const env = loadEnv();
  const app = express();
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use(projectsRouter);
  app.use(runsRouter);
  app.use(issuesRouter);
  app.use(pagesRouter);
  app.use(reportsRouter);
  app.use(profileRouter);
  app.use(schedulesRouter);
  app.use(workspaceRouter);
  app.use(renderRouter);
  app.use(integrationsRouter);
  app.use(goalsRouter);
  app.use(keywordsRouter);
  app.use(opportunitiesRouter);
  app.use(analyticsRouter);
  app.use(jobsRouter);
  app.use(recommendationsRouter);
  app.use(keywordFitRouter);
  app.use(maintenanceRouter);
  app.use(aiRouter);
  app.use(contentBriefsRouter);
  app.use(fixPlansRouter);
  app.use(auditRulesRouter);
  app.use(crawlScopeRouter);
  app.use(onboardingRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'validation failed', issues: err.issues });
      return;
    }
    const e = err as { statusCode?: number; message?: string };
    log.error({ err }, 'unhandled');
    res.status(e.statusCode ?? 500).json({ error: e.message ?? 'internal error' });
  });

  return app;
}
