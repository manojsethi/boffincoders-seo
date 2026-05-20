export { routeAI, availableProviders, type RouteOptions } from './router';
export { analyzeEvidence, type AnalyzeEvidenceOptions } from './analyze-evidence';
export type { AIProvider, AIRequest, AIResponse, AIClient } from './types';

// Register task definitions on module import. Side-effect import so any caller of `ai/*` sees the
// populated task registry.
import './tasks';
export { runTask, listTasks, getTask } from './task-service';
export type { TaskResult } from './task-service';
