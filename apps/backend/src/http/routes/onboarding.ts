import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import {
  ProjectModel,
  WebsiteProfileModel,
  KeywordModel,
  CrawlScopeRuleModel,
} from '../../db';
import { normalizeUrl } from '../../crawler/normalize/url';

/**
 * Phase 12 onboarding endpoints. Persist progress + lightweight intake data on existing models
 * (Project.onboardingState, WebsiteProfile draft, Keyword with source='onboarding', force_include
 * scope rules). No parallel onboarding model.
 */
export const onboardingRouter = Router();

const ALLOWED_STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// PATCH /projects/:id/onboarding — partial update to any onboarding field. Caller passes only
// what changed. We also accept side-effect fields like profile / objective so step 2 + 3 can
// route through one endpoint.
const PatchSchema = z.object({
  currentStep: z.number().int().min(1).max(8).optional(),
  markStepComplete: z.number().int().min(1).max(8).optional(),
  // Profile
  websiteType: z.string().max(60).optional(),
  websiteTypeCustom: z.string().max(120).optional(),
  websiteDescription: z.string().max(2000).optional(),
  primaryAudience: z.string().max(200).optional(),
  country: z.string().max(80).optional(),
  primaryLanguage: z.string().max(40).optional(),
  // Objective
  primaryObjective: z.string().max(120).optional(),
  secondaryObjectives: z.array(z.string().max(120)).max(8).optional(),
  objectiveNotes: z.string().max(2000).optional(),
  // Crawl setup
  crawlPreset: z.enum(['light', 'standard', 'full', 'custom']).optional(),
  maxPages: z.number().int().min(1).max(50000).optional(),
  skipIntegrations: z.boolean().optional(),
  handleDocuments: z.enum(['crawl', 'sample', 'exclude']).optional(),
  notes: z.string().max(4000).optional(),
});

onboardingRouter.patch('/projects/:id/onboarding', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'invalid project id' });
      return;
    }
    const body = PatchSchema.parse(req.body);
    const project = await ProjectModel.findById(req.params.id).lean();
    if (!project) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    const state = (project.onboardingState ?? {}) as Record<string, unknown>;
    const set: Record<string, unknown> = {};

    for (const k of [
      'currentStep',
      'websiteType',
      'websiteTypeCustom',
      'websiteDescription',
      'primaryAudience',
      'country',
      'primaryLanguage',
      'primaryObjective',
      'objectiveNotes',
      'crawlPreset',
      'maxPages',
      'skipIntegrations',
      'handleDocuments',
      'notes',
    ] as const) {
      const v = (body as Record<string, unknown>)[k];
      if (v !== undefined) set[`onboardingState.${k}`] = v;
    }
    if (body.secondaryObjectives !== undefined)
      set['onboardingState.secondaryObjectives'] = body.secondaryObjectives;

    if (body.markStepComplete) {
      const completed = new Set(
        ((state.completedSteps as number[] | undefined) ?? []).map(Number),
      );
      completed.add(body.markStepComplete);
      set['onboardingState.completedSteps'] = [...completed].sort((a, b) => a - b);
      // Auto-advance currentStep to the next unfinished step.
      const next = ALLOWED_STEPS.find((s) => !completed.has(s));
      if (next && body.currentStep === undefined) {
        set['onboardingState.currentStep'] = next;
      }
    }

    // Mirror profile fields into WebsiteProfileModel as a draft so the rest of the product can
    // read them through the existing profile reader. Doc 12 §"Data Model Direction".
    const profileFields = [
      'websiteType',
      'websiteDescription',
      'primaryAudience',
    ] as const;
    const profileTouched = profileFields.some(
      (k) => (body as Record<string, unknown>)[k] !== undefined,
    );
    if (profileTouched) {
      const pid = new Types.ObjectId(req.params.id);
      const category =
        body.websiteType === 'other' && body.websiteTypeCustom
          ? body.websiteTypeCustom
          : body.websiteType;
      const update: Record<string, unknown> = {};
      if (category !== undefined) {
        update.websiteCategory = category;
        update.categorySource = 'analyst';
        update.categoryConfidence = 1;
      }
      if (body.websiteDescription !== undefined) update.description = body.websiteDescription;
      if (body.primaryAudience !== undefined) update.audienceSegments = [body.primaryAudience];
      if (Object.keys(update).length > 0) {
        update.lastSuggestedAt = new Date();
        await WebsiteProfileModel.updateOne(
          { projectId: pid },
          { $set: update, $setOnInsert: { projectId: pid } },
          { upsert: true },
        );
      }
    }

    // Mirror objective into Project.goals (one lightweight Goal seed) so the existing Goals
    // module can later promote it without losing the analyst's intent.
    if (body.primaryObjective !== undefined || body.secondaryObjectives !== undefined) {
      const objective = body.primaryObjective ?? (state.primaryObjective as string | undefined);
      if (objective) {
        set['goals'] = [
          {
            id: 'onboarding-objective',
            type: objective,
            label: objective,
            status: 'active',
            source: 'onboarding',
            notes: body.objectiveNotes ?? state.objectiveNotes ?? '',
            secondary: body.secondaryObjectives ?? state.secondaryObjectives ?? [],
          },
          ...((project.goals as Array<Record<string, unknown>> | undefined) ?? []).filter(
            (g) => g.id !== 'onboarding-objective',
          ),
        ];
      }
    }

    const updated = await ProjectModel.findOneAndUpdate(
      { _id: req.params.id },
      { $set: set },
      { new: true },
    ).lean();
    res.json({
      onboardingState: updated?.onboardingState ?? {},
      goals: updated?.goals ?? [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /projects/:id/onboarding/keywords — bulk seed keywords.
 * Accepts a list of strings or objects. Dedupes by lower-case keyword (per project).
 */
const KeywordsSchema = z.object({
  keywords: z
    .array(
      z.union([
        z.string().min(1).max(200),
        z.object({
          keyword: z.string().min(1).max(200),
          priority: z.enum(['P0', 'P1', 'P2']).optional(),
          intent: z
            .enum([
              'informational',
              'commercial',
              'transactional',
              'navigational',
              'local',
              'support',
              'unknown',
            ])
            .optional(),
          targetUrl: z.string().max(800).optional(),
          notes: z.string().max(500).optional(),
        }),
      ]),
    )
    .max(500),
});
onboardingRouter.post(
  '/projects/:id/onboarding/keywords',
  async (req, res, next) => {
    try {
      if (!Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ error: 'invalid project id' });
        return;
      }
      const body = KeywordsSchema.parse(req.body);
      const pid = new Types.ObjectId(req.params.id);
      const cleaned = body.keywords
        .map((k) => (typeof k === 'string' ? { keyword: k } : k))
        .map((k) => ({
          ...k,
          keyword: k.keyword.trim(),
        }))
        .filter((k) => k.keyword.length > 0);
      const lower = new Set<string>();
      const deduped = cleaned.filter((k) => {
        const lk = k.keyword.toLowerCase();
        if (lower.has(lk)) return false;
        lower.add(lk);
        return true;
      });
      // Skip ones that already exist (case-insensitive) for this project.
      const existing = await KeywordModel.find({
        projectId: pid,
        keyword: { $in: deduped.map((k) => k.keyword) },
      })
        .select({ keyword: 1 })
        .lean();
      const existingLower = new Set(existing.map((e) => e.keyword.toLowerCase()));
      const toInsert = deduped.filter((k) => !existingLower.has(k.keyword.toLowerCase()));
      let inserted: Array<Record<string, unknown>> = [];
      if (toInsert.length > 0) {
        const docs = await KeywordModel.insertMany(
          toInsert.map((k) => {
            const kRecord = k as {
              keyword: string;
              priority?: 'P0' | 'P1' | 'P2';
              intent?: string;
              targetUrl?: string;
              notes?: string;
            };
            return {
              projectId: pid,
              keyword: kRecord.keyword,
              source: 'onboarding',
              intent: kRecord.intent ?? 'unknown',
              priority: kRecord.priority ?? 'P2',
              notes: kRecord.notes ?? '',
              preferredUrl: kRecord.targetUrl ?? undefined,
              status: 'candidate',
            };
          }),
        );
        inserted = docs.map((d) => d.toObject());
      }
      const totalSeed = await KeywordModel.countDocuments({
        projectId: pid,
        source: 'onboarding',
      });
      await ProjectModel.updateOne(
        { _id: pid },
        { $set: { 'onboardingState.seedKeywordCount': totalSeed } },
      );
      res.json({
        inserted: inserted.length,
        skipped: deduped.length - toInsert.length,
        totalSeedKeywords: totalSeed,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /projects/:id/onboarding/important-pages — bulk add important URLs as force_include scope
 * rules. Each URL becomes a `prefix` rule so it always enters the crawl frontier.
 */
const PagesSchema = z.object({
  urls: z.array(z.string().min(1).max(800)).max(100),
  label: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});
onboardingRouter.post(
  '/projects/:id/onboarding/important-pages',
  async (req, res, next) => {
    try {
      if (!Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ error: 'invalid project id' });
        return;
      }
      const body = PagesSchema.parse(req.body);
      const project = await ProjectModel.findById(req.params.id).lean();
      if (!project) {
        res.status(404).json({ error: 'project not found' });
        return;
      }
      const pid = new Types.ObjectId(req.params.id);
      const primaryHost = project.primaryDomain.toLowerCase();
      const accepted: string[] = [];
      const rejected: Array<{ url: string; reason: string }> = [];
      for (const raw of body.urls) {
        const n = normalizeUrl(raw);
        if (!n) {
          rejected.push({ url: raw, reason: 'invalid URL' });
          continue;
        }
        let path = n;
        try {
          const u = new URL(n);
          if (
            u.hostname.toLowerCase() !== primaryHost &&
            !(
              project.includeSubdomains &&
              u.hostname.toLowerCase().endsWith(`.${primaryHost}`)
            )
          ) {
            rejected.push({ url: raw, reason: 'outside project domain' });
            continue;
          }
          path = u.pathname || '/';
        } catch {
          rejected.push({ url: raw, reason: 'invalid URL' });
          continue;
        }
        accepted.push(path);
      }
      // Upsert force_include rules, one per unique path.
      const created: Array<Record<string, unknown>> = [];
      for (const path of [...new Set(accepted)]) {
        const r = await CrawlScopeRuleModel.findOneAndUpdate(
          {
            projectId: pid,
            pattern: path,
            behavior: 'force_include',
          },
          {
            $set: {
              name: `Important page: ${path}`,
              patternType: 'prefix',
              behavior: 'force_include',
              sampleLimit: 0,
              priority: 200,
              groupName: body.label || 'Important pages',
              pageFamily: '',
              reason: body.notes || 'Analyst-marked important during onboarding',
              source: 'analyst',
              confidence: 1,
              status: 'approved',
              approvedAt: new Date(),
            },
            $setOnInsert: {
              projectId: pid,
              pattern: path,
            },
          },
          { upsert: true, new: true },
        ).lean();
        if (r) created.push(r);
      }
      const totalImportant = await CrawlScopeRuleModel.countDocuments({
        projectId: pid,
        behavior: 'force_include',
        source: 'analyst',
      });
      await ProjectModel.updateOne(
        { _id: pid },
        { $set: { 'onboardingState.importantPageCount': totalImportant } },
      );
      res.json({
        accepted: accepted.length,
        rejected,
        upserted: created.length,
        totalImportantPages: totalImportant,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /projects/:id/onboarding/important-pages — list current important-page rules (so review
 * + step 5 UI can re-render after refresh).
 */
onboardingRouter.get(
  '/projects/:id/onboarding/important-pages',
  async (req, res, next) => {
    try {
      if (!Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ error: 'invalid project id' });
        return;
      }
      const pid = new Types.ObjectId(req.params.id);
      const rules = await CrawlScopeRuleModel.find({
        projectId: pid,
        behavior: 'force_include',
        source: 'analyst',
      })
        .sort({ createdAt: 1 })
        .lean();
      res.json(
        rules.map((r) => ({
          id: String(r._id),
          pattern: r.pattern,
          patternType: r.patternType,
          label: r.groupName,
          notes: r.reason,
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /projects/:id/onboarding/important-pages/:ruleId — remove one important-page rule.
 */
onboardingRouter.delete(
  '/projects/:id/onboarding/important-pages/:ruleId',
  async (req, res, next) => {
    try {
      const r = await CrawlScopeRuleModel.findOneAndDelete({
        _id: req.params.ruleId,
        projectId: req.params.id,
      }).lean();
      if (!r) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const pid = new Types.ObjectId(req.params.id);
      const totalImportant = await CrawlScopeRuleModel.countDocuments({
        projectId: pid,
        behavior: 'force_include',
        source: 'analyst',
      });
      await ProjectModel.updateOne(
        { _id: pid },
        { $set: { 'onboardingState.importantPageCount': totalImportant } },
      );
      res.json({ ok: true, totalImportantPages: totalImportant });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /projects/:id/onboarding/complete — flag onboarding as done so the project shell stops
 * gating navigation. Idempotent.
 */
onboardingRouter.post(
  '/projects/:id/onboarding/complete',
  async (req, res, next) => {
    try {
      if (!Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ error: 'invalid project id' });
        return;
      }
      const r = await ProjectModel.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            'onboardingState.completedAt': new Date(),
            'onboardingState.completedSteps': [1, 2, 3, 4, 5, 6, 7, 8],
            'onboardingState.currentStep': 8,
            lifecycleState: 'ready-for-first-crawl',
          },
        },
        { new: true },
      ).lean();
      if (!r) {
        res.status(404).json({ error: 'project not found' });
        return;
      }
      res.json({ ok: true, onboardingState: r.onboardingState ?? {} });
    } catch (err) {
      next(err);
    }
  },
);
