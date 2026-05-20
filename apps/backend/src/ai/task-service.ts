// AI Task Service. Doc continuation §"Phase 4 — AI Task System Alignment".
//
// Single entry point for every AI task in the product. Centralizes:
//   - task registry (typed input/output)
//   - prompt template + version
//   - schema validation of model output
//   - cost/risk tier policy (local-first for low-risk, premium only when explicitly requested)
//   - audit log via AiTaskRunModel
//   - graceful "unavailable" response when no provider configured
//
// All AI features call this service. No direct routeAI() calls outside this module.

import { Types } from 'mongoose';
import { z, type ZodTypeAny, type ZodSchema } from 'zod';
import { AiTaskRunModel } from '../db';
import { availableProviders, routeAI } from './router';
import type { AIProvider } from './types';
import { getLogger } from '../config/logger';

const log = getLogger('ai:task-service');

export type TaskTier = 'cheap' | 'premium';
export type TaskRisk = 'low' | 'medium' | 'high';

export type TaskRunInput<TParams> = {
  projectId: string;
  params: TParams;
  sourceIds?: Record<string, string>;
  // Force a specific provider (analyst override). Otherwise router picks per tier.
  preferredProvider?: AIProvider;
};

export type TaskResult<TOutput> = {
  id: string;
  taskKey: string;
  status: 'completed' | 'failed' | 'unavailable';
  provider?: AIProvider;
  model?: string;
  output: TOutput | null;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  warnings: string[];
  needsAnalystReview: boolean;
  costEstimateUsd: number;
  error?: string;
  promptTemplateVersion: string;
  durationMs: number;
};

export type AITask<TParams, TOutput> = {
  key: string;
  label: string;
  description: string;
  affects: string[];
  riskLevel: TaskRisk;
  tier: TaskTier;
  promptTemplateVersion: string;
  maxInputChars: number;
  maxOutputTokens: number;
  // The task may need analyst review by default.
  needsAnalystReview: boolean;
  buildPrompt: (params: TParams) => { system: string; user: string };
  outputSchema: ZodSchema<TOutput>;
  // Optional: post-process structured output (e.g. clamp arrays, normalize fields).
  postProcess?: (out: TOutput, params: TParams) => TOutput;
};

const TASKS: Record<string, AITask<unknown, unknown>> = {};

export function registerTask<TParams, TOutput>(task: AITask<TParams, TOutput>): void {
  TASKS[task.key] = task as unknown as AITask<unknown, unknown>;
}

export function listTasks(): Array<{
  key: string;
  label: string;
  description: string;
  affects: string[];
  riskLevel: TaskRisk;
  tier: TaskTier;
  needsAnalystReview: boolean;
}> {
  return Object.values(TASKS).map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    affects: t.affects,
    riskLevel: t.riskLevel,
    tier: t.tier,
    needsAnalystReview: t.needsAnalystReview,
  }));
}

export function getTask(key: string): AITask<unknown, unknown> | null {
  return TASKS[key] ?? null;
}

/**
 * Public entry point for every AI call. Audit-logged, schema-validated, graceful when no provider
 * is configured.
 */
export async function runTask<TParams, TOutput>(
  key: string,
  input: TaskRunInput<TParams>,
): Promise<TaskResult<TOutput>> {
  const task = TASKS[key] as AITask<TParams, TOutput> | undefined;
  if (!task) throw new Error(`unknown task: ${key}`);

  const pid = new Types.ObjectId(input.projectId);
  const startedAt = new Date();
  const runDoc = await AiTaskRunModel.create({
    projectId: pid,
    taskKey: task.key,
    promptTemplateVersion: task.promptTemplateVersion,
    sourceIds: input.sourceIds ?? {},
    status: 'running',
    startedAt,
    needsAnalystReview: task.needsAnalystReview,
  });

  // No provider configured → graceful unavailable, no throw.
  const providers = availableProviders();
  if (providers.length === 0) {
    const finishedAt = new Date();
    await AiTaskRunModel.updateOne(
      { _id: runDoc._id },
      {
        $set: {
          status: 'unavailable',
          schemaValidationStatus: 'not-run',
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          warnings: ['No AI provider configured. Set OPENROUTER_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or AI_LOCAL_MODEL_URL.'],
        },
      },
    );
    return {
      id: String(runDoc._id),
      taskKey: task.key,
      status: 'unavailable',
      output: null,
      confidence: 0,
      confidenceLevel: 'low',
      warnings: ['AI is not configured for this environment.'],
      needsAnalystReview: false,
      costEstimateUsd: 0,
      promptTemplateVersion: task.promptTemplateVersion,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  const { system, user } = task.buildPrompt(input.params);
  if (user.length > task.maxInputChars) {
    // Truncate hard rather than throw — model would refuse oversized input anyway.
    log.warn({ task: task.key, inputLen: user.length, max: task.maxInputChars }, 'truncating prompt');
  }
  const truncatedUser =
    user.length > task.maxInputChars
      ? user.slice(0, task.maxInputChars) + '\n\n[input truncated]'
      : user;

  try {
    const res = await routeAI(
      {
        systemPrompt: system,
        userPrompt: truncatedUser,
        json: true,
        maxOutputTokens: task.maxOutputTokens,
        temperature: 0.2,
        tier: task.tier,
      },
      {
        provider: input.preferredProvider,
        allowFallback: true,
      },
    );

    // Parse JSON output + validate against schema. Each failure mode is recorded distinctly so
    // analyst can tell a model JSON glitch from a schema drift. Always persist provider/model
    // up-front — local model debugging needs that even when parsing later fails. Audit
    // 2026-05-20 follow-up.
    const baseFailMeta = {
      provider: res.provider,
      model: res.model,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costEstimateUsd: res.costEstimateUsd,
    };
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(res.content));
    } catch (parseErr) {
      await AiTaskRunModel.updateOne(
        { _id: runDoc._id },
        { $set: { ...baseFailMeta, schemaValidationStatus: 'invalid-json' } },
      );
      throw new Error(
        `Model returned non-JSON output: ${parseErr instanceof Error ? parseErr.message : 'parse error'}`,
      );
    }
    let validated: TOutput;
    try {
      validated = task.outputSchema.parse(parsed);
    } catch (schemaErr) {
      await AiTaskRunModel.updateOne(
        { _id: runDoc._id },
        { $set: { ...baseFailMeta, schemaValidationStatus: 'invalid-schema' } },
      );
      throw new Error(
        `Model output did not match the expected schema: ${schemaErr instanceof Error ? schemaErr.message : 'validation failed'}`,
      );
    }
    const out = task.postProcess ? task.postProcess(validated, input.params) : validated;

    // Confidence: prefer model-reported confidence if present in output, otherwise heuristic
    // based on whether warnings were generated.
    const reported = (out as { confidence?: number } | null | undefined)?.confidence;
    const confidence = typeof reported === 'number' ? Math.max(0, Math.min(1, reported)) : 0.7;
    const confidenceLevel: 'high' | 'medium' | 'low' =
      confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    await AiTaskRunModel.updateOne(
      { _id: runDoc._id },
      {
        $set: {
          status: 'completed',
          schemaValidationStatus: 'ok',
          provider: res.provider,
          model: res.model,
          finishedAt,
          durationMs,
          output: out,
          confidence,
          confidenceLevel,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          costEstimateUsd: res.costEstimateUsd,
        },
      },
    );
    return {
      id: String(runDoc._id),
      taskKey: task.key,
      status: 'completed',
      provider: res.provider,
      model: res.model,
      output: out,
      confidence,
      confidenceLevel,
      warnings: [],
      needsAnalystReview: task.needsAnalystReview,
      costEstimateUsd: res.costEstimateUsd,
      promptTemplateVersion: task.promptTemplateVersion,
      durationMs,
    };
  } catch (err) {
    const finishedAt = new Date();
    const msg = err instanceof Error ? err.message : String(err);
    await AiTaskRunModel.updateOne(
      { _id: runDoc._id },
      {
        $set: {
          status: 'failed',
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: msg,
        },
      },
    );
    return {
      id: String(runDoc._id),
      taskKey: task.key,
      status: 'failed',
      output: null,
      confidence: 0,
      confidenceLevel: 'low',
      warnings: [],
      needsAnalystReview: false,
      costEstimateUsd: 0,
      error: msg,
      promptTemplateVersion: task.promptTemplateVersion,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }
}

function stripCodeFences(s: string): string {
  return s.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
}

// Re-export Zod helpers for task definitions that want them.
export { z, type ZodTypeAny };
