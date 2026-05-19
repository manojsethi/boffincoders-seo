import { Types } from 'mongoose';
import {
  CrawlRunModel,
  AuditRunModel,
  AIAnalysisModel,
  ReportModel,
  ProjectModel,
} from '../db';
import type { CrawlMode } from '@boffin/schemas';
import { syncLifecycleState } from './lifecycle';

export type CreateCrawlRunInput = {
  projectId: string;
  mode?: CrawlMode;
  seedUrl?: string;
  maxPages?: number;
  triggeredBy?: 'user' | 'schedule' | 'system';
};

export async function createCrawlRun(input: CreateCrawlRunInput): Promise<{ id: string }> {
  const projectId = new Types.ObjectId(input.projectId);
  const existing = await CrawlRunModel.findOne({
    projectId,
    status: { $in: ['queued', 'running'] },
  }).lean();
  if (existing) throw new Error('A crawl is already in progress for this project');

  const doc = await CrawlRunModel.create({
    projectId,
    mode: input.mode ?? 'first',
    status: 'queued',
    seedUrl: input.seedUrl,
    maxPages: input.maxPages ?? 200,
    triggeredBy: input.triggeredBy ?? 'user',
  });
  await syncLifecycleState(projectId);
  return { id: String(doc._id) };
}

export async function createAuditRun(input: {
  projectId: string;
  crawlRunId?: string;
  triggeredBy?: 'user' | 'schedule' | 'system';
}): Promise<{ id: string; crawlRunId: string }> {
  const projectId = new Types.ObjectId(input.projectId);
  let crawlRunId: Types.ObjectId;
  if (input.crawlRunId) {
    crawlRunId = new Types.ObjectId(input.crawlRunId);
  } else {
    const latest = await CrawlRunModel.findOne({ projectId, status: 'completed' })
      .sort({ completedAt: -1 })
      .lean();
    if (!latest) throw new Error('No completed crawl available — run a crawl first');
    crawlRunId = latest._id;
  }
  const existing = await AuditRunModel.findOne({ projectId, status: { $in: ['queued', 'running'] } }).lean();
  if (existing) throw new Error('An audit is already in progress for this project');

  const doc = await AuditRunModel.create({
    projectId,
    crawlRunId,
    status: 'queued',
    triggeredBy: input.triggeredBy ?? 'user',
  });
  await syncLifecycleState(projectId);
  return { id: String(doc._id), crawlRunId: String(crawlRunId) };
}

export async function createAIAnalysis(input: {
  projectId: string;
  crawlRunId?: string;
  auditRunId?: string;
}): Promise<{ id: string; crawlRunId: string; auditRunId: string }> {
  const projectId = new Types.ObjectId(input.projectId);
  let auditRunId: Types.ObjectId;
  if (input.auditRunId) {
    auditRunId = new Types.ObjectId(input.auditRunId);
  } else {
    const audit = await AuditRunModel.findOne({ projectId, status: 'completed' })
      .sort({ completedAt: -1 })
      .lean();
    if (!audit) throw new Error('No completed audit found — run an audit first');
    auditRunId = audit._id;
  }
  const auditDoc = await AuditRunModel.findById(auditRunId).lean();
  if (!auditDoc) throw new Error('Audit run not found');
  const crawlRunId = input.crawlRunId ? new Types.ObjectId(input.crawlRunId) : auditDoc.crawlRunId;

  const doc = await AIAnalysisModel.create({
    projectId,
    sourceCrawlRunId: crawlRunId,
    sourceAuditRunId: auditRunId,
    modelProvider: 'pending',
    modelName: 'pending',
    status: 'queued',
  });
  await syncLifecycleState(projectId);
  return { id: String(doc._id), crawlRunId: String(crawlRunId), auditRunId: String(auditRunId) };
}

export async function createReportDraft(input: {
  projectId: string;
  type: 'initial-audit' | 'weekly-progress' | 'monthly-progress' | 'verification' | 'internal';
  view?: 'client' | 'internal';
  crawlRunId?: string;
  auditRunId?: string;
  periodStart?: Date;
  periodEnd?: Date;
}): Promise<{ id: string; crawlRunId?: string; auditRunId?: string }> {
  const projectId = new Types.ObjectId(input.projectId);
  const project = await ProjectModel.findById(projectId).lean();
  if (!project) throw new Error('Project not found');

  let crawlRunId: Types.ObjectId | undefined;
  let auditRunId: Types.ObjectId | undefined;

  if (input.type === 'initial-audit' || input.type === 'verification') {
    if (input.crawlRunId && input.auditRunId) {
      crawlRunId = new Types.ObjectId(input.crawlRunId);
      auditRunId = new Types.ObjectId(input.auditRunId);
    } else {
      const audit = await AuditRunModel.findOne({ projectId, status: 'completed' })
        .sort({ completedAt: -1 })
        .lean();
      if (!audit) throw new Error('No completed audit available for report');
      auditRunId = audit._id;
      crawlRunId = new Types.ObjectId(String(audit.crawlRunId));
    }
  }

  const doc = await ReportModel.create({
    projectId,
    type: input.type,
    view: input.view ?? 'client',
    status: 'draft',
    sourceCrawlRunIds: crawlRunId ? [crawlRunId] : [],
    sourceAuditRunIds: auditRunId ? [auditRunId] : [],
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  return {
    id: String(doc._id),
    crawlRunId: crawlRunId ? String(crawlRunId) : undefined,
    auditRunId: auditRunId ? String(auditRunId) : undefined,
  };
}
