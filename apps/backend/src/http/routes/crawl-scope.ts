import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import {
  CrawlScopeRuleModel,
  UrlGroupModel,
  CrawlCandidateModel,
  ProjectModel,
} from '../../db';
import { runDiscovery, ensureDefaultScopeRules } from '../../crawler/scope/discover';
import { compilePattern, type PatternType } from '../../crawler/scope/match';
import { runTask } from '../../ai/task-service';
import { WebsiteProfileModel } from '../../db';

export const crawlScopeRouter = Router();

/**
 * Crawl scope routes. Phase 11.
 *
 * Resource layout under /projects/:id:
 *   /crawl-scope/rules               CRUD scope rules + seed-defaults
 *   /crawl-scope/test-pattern        compile + match against URL list (UI utility)
 *   /crawl-scope/estimate            run discovery without persisting → pre-crawl summary
 *   /crawl-scope/groups              list URL groups from latest crawl
 *   /crawl-scope/candidates          list per-URL decisions from latest crawl
 */

function shapeRule(r: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String((r as { _id: Types.ObjectId })._id),
    name: r.name,
    pattern: r.pattern,
    patternType: r.patternType ?? 'glob',
    behavior: r.behavior,
    sampleLimit: r.sampleLimit ?? 5,
    priority: r.priority ?? 50,
    groupName: r.groupName ?? '',
    pageFamily: r.pageFamily ?? '',
    reason: r.reason ?? '',
    source: r.source ?? 'system',
    confidence: r.confidence ?? 0.8,
    status: r.status ?? 'approved',
    normalizeStripParams: r.normalizeStripParams ?? [],
    suggestionWarning: r.suggestionWarning ?? '',
    approvedAt: r.approvedAt ?? null,
    rejectedAt: r.rejectedAt ?? null,
    rejectedReason: r.rejectedReason ?? '',
    createdAt: (r as { createdAt?: Date }).createdAt,
    updatedAt: (r as { updatedAt?: Date }).updatedAt,
  };
}

const RuleSchema = z.object({
  name: z.string().min(1).max(160),
  pattern: z.string().min(1).max(400),
  patternType: z.enum(['glob', 'prefix', 'regex']).default('glob'),
  behavior: z.enum(['crawl', 'sample', 'exclude', 'force_include', 'normalize']),
  sampleLimit: z.number().int().min(1).max(500).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  groupName: z.string().max(120).optional(),
  pageFamily: z.string().max(60).optional(),
  reason: z.string().max(500).optional(),
  status: z.enum(['suggested', 'approved', 'rejected', 'disabled']).optional(),
  source: z.enum(['system', 'heuristic', 'ai', 'analyst']).optional(),
  normalizeStripParams: z.array(z.string().max(60)).optional(),
});

// Patterns that represent internal crawler hygiene (static assets) and should not appear in the
// analyst-facing scope table. Doc 12 §"Step 6 — Crawl Scope Rules": "Do not show internal
// crawler guards". The rule rows still exist in Mongo so the crawler honors them; the API
// hides them unless the caller passes `?includeAssets=1`.
const ASSET_PATTERN_RE = /\*\*\/\*\.(css|js|jpg|jpeg|png|gif|svg|webp|woff|woff2|ico|map|mjs)$/i;

crawlScopeRouter.get('/projects/:id/crawl-scope/rules', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    await ensureDefaultScopeRules(req.params.id);
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.status) q.status = req.query.status;
    if (req.query.source) q.source = req.query.source;
    const rules = await CrawlScopeRuleModel.find(q)
      .sort({ priority: -1, name: 1 })
      .lean();
    const includeAssets =
      req.query.includeAssets === '1' || req.query.includeAssets === 'true';
    const shown = includeAssets
      ? rules
      : rules.filter(
          (r) => !(r.source === 'system' && ASSET_PATTERN_RE.test(r.pattern ?? '')),
        );
    res.json(shown.map(shapeRule));
  } catch (err) {
    next(err);
  }
});

crawlScopeRouter.post('/projects/:id/crawl-scope/rules', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = RuleSchema.parse(req.body);
    // Validate pattern compiles. Regex patterns can throw.
    try {
      compilePattern(body.pattern, body.patternType as PatternType);
    } catch (err) {
      res.status(400).json({ error: `Invalid pattern: ${(err as Error).message}` });
      return;
    }
    const r = await CrawlScopeRuleModel.create({
      projectId: new Types.ObjectId(req.params.id),
      ...body,
      source: body.source ?? 'analyst',
      status: body.status ?? 'approved',
      approvedAt: (body.status ?? 'approved') === 'approved' ? new Date() : undefined,
    });
    res.status(201).json(shapeRule(r.toObject() as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
});

const PatchRuleSchema = RuleSchema.partial();
crawlScopeRouter.patch(
  '/projects/:id/crawl-scope/rules/:ruleId',
  async (req, res, next) => {
    try {
      if (
        !Types.ObjectId.isValid(req.params.id) ||
        !Types.ObjectId.isValid(req.params.ruleId)
      ) {
        res.status(400).json({ error: 'invalid id' });
        return;
      }
      const body = PatchRuleSchema.parse(req.body);
      if (body.pattern || body.patternType) {
        const existing = await CrawlScopeRuleModel.findById(req.params.ruleId).lean();
        if (!existing) {
          res.status(404).json({ error: 'rule not found' });
          return;
        }
        try {
          compilePattern(
            body.pattern ?? existing.pattern,
            (body.patternType ?? existing.patternType) as PatternType,
          );
        } catch (err) {
          res.status(400).json({ error: `Invalid pattern: ${(err as Error).message}` });
          return;
        }
      }
      const set: Record<string, unknown> = { ...body };
      if (body.status === 'approved') set.approvedAt = new Date();
      if (body.status === 'rejected') set.rejectedAt = new Date();
      const r = await CrawlScopeRuleModel.findOneAndUpdate(
        { _id: req.params.ruleId, projectId: req.params.id },
        { $set: set },
        { new: true },
      ).lean();
      if (!r) {
        res.status(404).json({ error: 'rule not found' });
        return;
      }
      res.json(shapeRule(r));
    } catch (err) {
      next(err);
    }
  },
);

crawlScopeRouter.delete(
  '/projects/:id/crawl-scope/rules/:ruleId',
  async (req, res, next) => {
    try {
      const r = await CrawlScopeRuleModel.findOneAndDelete({
        _id: req.params.ruleId,
        projectId: req.params.id,
      }).lean();
      if (!r) {
        res.status(404).json({ error: 'rule not found' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Pattern tester. Doc 11 §"test pattern + view matched URLs".
const TestPatternSchema = z.object({
  pattern: z.string().min(1).max(400),
  patternType: z.enum(['glob', 'prefix', 'regex']).default('glob'),
  // Optional explicit URL list. If absent, sample from latest crawl candidates.
  urls: z.array(z.string()).max(2000).optional(),
});
crawlScopeRouter.post(
  '/projects/:id/crawl-scope/test-pattern',
  async (req, res, next) => {
    try {
      if (!Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ error: 'invalid project id' });
        return;
      }
      const body = TestPatternSchema.parse(req.body);
      let compiled;
      try {
        compiled = compilePattern(body.pattern, body.patternType as PatternType);
      } catch (err) {
        res.status(400).json({ error: `Invalid pattern: ${(err as Error).message}` });
        return;
      }
      let pool: string[] = body.urls ?? [];
      if (pool.length === 0) {
        const pid = new Types.ObjectId(req.params.id);
        // Pull URLs from latest crawl candidates (most recent run).
        const latest = await CrawlCandidateModel.findOne({ projectId: pid })
          .sort({ createdAt: -1 })
          .select({ crawlRunId: 1 })
          .lean();
        if (latest) {
          const rows = await CrawlCandidateModel.find({
            projectId: pid,
            crawlRunId: latest.crawlRunId,
          })
            .select({ normalizedUrl: 1 })
            .limit(2000)
            .lean();
          pool = rows.map((r) => r.normalizedUrl);
        }
      }
      const matches = pool.filter((u) => compiled.test(u));
      res.json({
        totalChecked: pool.length,
        matchCount: matches.length,
        examples: matches.slice(0, 50),
      });
    } catch (err) {
      next(err);
    }
  },
);

// Pre-crawl estimate. Runs discovery + decisions but does NOT persist or fetch.
const EstimateSchema = z.object({
  seedUrl: z.string().url().optional(),
  maxPages: z.number().int().min(1).max(50000).optional(),
  previewSuggested: z.boolean().optional(),
});
crawlScopeRouter.post('/projects/:id/crawl-scope/estimate', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = EstimateSchema.parse(req.body ?? {});
    const project = await ProjectModel.findById(req.params.id).lean();
    if (!project) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    const scopeEnabled = project.crawlScopeSettings?.enabled !== false;
    const result = await runDiscovery({
      projectId: req.params.id,
      seedUrl: body.seedUrl,
      maxPages: body.maxPages ?? 200,
      previewSuggested: body.previewSuggested ?? false,
      // P2 audit fix: when scope is disabled, bypass rule matching inside the estimate so the
      // numbers reflect what the crawl will actually do (seed + sitemap + all internal links,
      // no scope filtering). Otherwise the UI showed sampled/excluded counts that never apply.
      bypassRules: !scopeEnabled,
    });
    const warnings = [...result.warnings];
    if (!scopeEnabled) {
      warnings.unshift({
        severity: 'medium',
        message:
          'Scope is currently disabled — these numbers reflect a no-scope crawl. Enable scope at the top of this card to use approved rules.',
      });
    }
    res.json({
      scopeEnabled,
      totals: result.totals,
      groups: result.groups,
      warnings,
      sampleCandidates: result.candidates.slice(0, 50),
    });
  } catch (err) {
    next(err);
  }
});

// URL groups for the latest crawl
crawlScopeRouter.get('/projects/:id/crawl-scope/groups', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.crawlRunId && Types.ObjectId.isValid(String(req.query.crawlRunId))) {
      q.crawlRunId = new Types.ObjectId(String(req.query.crawlRunId));
    } else {
      const latest = await UrlGroupModel.findOne({ projectId: pid })
        .sort({ createdAt: -1 })
        .select({ crawlRunId: 1 })
        .lean();
      if (latest?.crawlRunId) q.crawlRunId = latest.crawlRunId;
    }
    const groups = await UrlGroupModel.find(q).sort({ discoveredCount: -1 }).lean();
    res.json(
      groups.map((g) => ({
        id: String(g._id),
        crawlRunId: g.crawlRunId ? String(g.crawlRunId) : null,
        name: g.name,
        pattern: g.pattern,
        pageFamily: g.pageFamily,
        behavior: g.behavior,
        sampleLimit: g.sampleLimit,
        discoveredCount: g.discoveredCount,
        crawledCount: g.crawledCount,
        sampledCount: g.sampledCount,
        excludedCount: g.excludedCount,
        examples: g.examples,
        sourceRuleId: g.sourceRuleId ? String(g.sourceRuleId) : null,
        confidence: g.confidence,
        lastEvaluatedAt: g.lastEvaluatedAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// Crawl candidates (per-URL decisions)
crawlScopeRouter.get('/projects/:id/crawl-scope/candidates', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const pid = new Types.ObjectId(req.params.id);
    const q: Record<string, unknown> = { projectId: pid };
    if (req.query.crawlRunId && Types.ObjectId.isValid(String(req.query.crawlRunId))) {
      q.crawlRunId = new Types.ObjectId(String(req.query.crawlRunId));
    } else {
      const latest = await CrawlCandidateModel.findOne({ projectId: pid })
        .sort({ createdAt: -1 })
        .select({ crawlRunId: 1 })
        .lean();
      if (latest?.crawlRunId) q.crawlRunId = latest.crawlRunId;
    }
    if (req.query.decision) q.decision = req.query.decision;
    if (req.query.groupName) q.groupName = req.query.groupName;
    const limit = Math.min(2000, Number(req.query.limit ?? 500));
    const rows = await CrawlCandidateModel.find(q)
      .sort({ decision: 1 })
      .limit(limit)
      .lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        url: r.url,
        normalizedUrl: r.normalizedUrl,
        source: r.source,
        matchedRuleId: r.matchedRuleId ? String(r.matchedRuleId) : null,
        matchedRuleName: r.matchedRuleName,
        groupName: r.groupName,
        groupPattern: r.groupPattern,
        decision: r.decision,
        reason: r.reason,
        sampleReason: r.sampleReason,
        selectedForCrawl: r.selectedForCrawl,
        sitemapLastmod: r.sitemapLastmod ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// AI suggestions. Doc 11 §"AI-Assisted Suggestions". Result is persisted as `suggested` rules
// — never silently applied.
const SuggestSchema = z.object({
  seedUrl: z.string().url().optional(),
});
crawlScopeRouter.post('/projects/:id/crawl-scope/ai-suggest', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = SuggestSchema.parse(req.body ?? {});
    const project = await ProjectModel.findById(req.params.id).lean();
    if (!project) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    if (project.crawlScopeSettings?.aiSuggestionsEnabled === false) {
      res.status(409).json({ error: 'AI suggestions disabled for this project.' });
      return;
    }
    // Run discovery first so we have real candidate groups.
    const discovery = await runDiscovery({
      projectId: req.params.id,
      seedUrl: body.seedUrl,
      maxPages: 500,
    });
    const candidateGroups = discovery.groups
      .slice(0, 30)
      .map((g) => ({
        name: g.name,
        pattern: g.pattern,
        discovered: g.discovered,
        examples: g.examples.slice(0, 5),
        behavior: g.behavior,
      }));
    const profile = await WebsiteProfileModel.findOne({ projectId: new Types.ObjectId(req.params.id) }).lean();
    const existingRules = (
      await CrawlScopeRuleModel.find({ projectId: new Types.ObjectId(req.params.id) })
        .select({ pattern: 1, behavior: 1, _id: 0 })
        .lean()
    ).map((r) => ({ pattern: r.pattern, behavior: r.behavior }));
    const result = await runTask('suggest-crawl-scope-rules', {
      projectId: req.params.id,
      params: {
        siteCategory: profile?.websiteCategory ?? '(unknown)',
        goals: (project.goals as Array<{ type: string; label?: string }> | undefined) ?? [],
        candidateGroups,
        existingRules,
      },
    });
    if (result.status !== 'completed' || !result.output) {
      res.status(502).json({
        error: 'AI task did not produce structured output',
        status: result.status,
        aiTaskRunId: result.id,
      });
      return;
    }
    const out = result.output as {
      suggestions: Array<{
        groupName: string;
        pattern: string;
        patternType?: string;
        behavior: string;
        sampleLimit?: number;
        pageFamily?: string;
        reason?: string;
        confidence?: number;
        riskIfWrong?: string;
      }>;
      warnings: Array<{ message: string; severity?: string }>;
    };
    const aiTaskRunId = result.id
      ? new Types.ObjectId(result.id)
      : undefined;
    const created: Array<Record<string, unknown>> = [];
    for (const s of out.suggestions) {
      // Validate pattern compiles before storing.
      try {
        compilePattern(s.pattern, (s.patternType as PatternType) ?? 'glob');
      } catch {
        continue;
      }
      const doc = await CrawlScopeRuleModel.create({
        projectId: new Types.ObjectId(req.params.id),
        name: s.groupName,
        pattern: s.pattern,
        patternType: (s.patternType as PatternType) ?? 'glob',
        behavior: s.behavior,
        sampleLimit: s.sampleLimit ?? 5,
        priority: 40, // below system rules; analyst can raise
        groupName: s.groupName,
        pageFamily: s.pageFamily ?? '',
        reason: s.reason ?? '',
        source: 'ai',
        confidence: s.confidence ?? 0.7,
        status: 'suggested',
        aiTaskRunId,
        suggestionWarning: s.riskIfWrong ?? '',
      });
      created.push(shapeRule(doc.toObject() as Record<string, unknown>));
    }
    res.json({
      suggestions: created,
      warnings: out.warnings ?? [],
      aiTaskRunId: result.id,
    });
  } catch (err) {
    next(err);
  }
});

// Project-level scope settings PATCH
const SettingsSchema = z.object({
  enabled: z.boolean().optional(),
  defaultBehavior: z.enum(['crawl', 'sample']).optional(),
  maxSamplePerGroup: z.number().int().min(1).max(200).optional(),
  aiSuggestionsEnabled: z.boolean().optional(),
  requireApprovalForAiRules: z.boolean().optional(),
});
crawlScopeRouter.patch('/projects/:id/crawl-scope/settings', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = SettingsSchema.parse(req.body);
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      set[`crawlScopeSettings.${k}`] = v;
    }
    const r = await ProjectModel.findOneAndUpdate(
      { _id: req.params.id },
      { $set: set },
      { new: true },
    )
      .select({ crawlScopeSettings: 1 })
      .lean();
    if (!r) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    res.json({ crawlScopeSettings: r.crawlScopeSettings ?? {} });
  } catch (err) {
    next(err);
  }
});
