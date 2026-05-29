// Public AI surface. Refactor 2026-05-28: single OpenRouter-backed service.
export {
  runAICompletion,
  isAIAvailable,
  AI_PROVIDER,
  AI_MODEL_DEFAULT,
  type AICompletionRequest,
  type AICompletionResponse,
} from './ai-service';

export { analyzeEvidence, type AnalyzeEvidenceOptions } from './analyze-evidence';

// Register task definitions on module import.
import './tasks';
export { runTask, listTasks, getTask } from './task-service';
export type { TaskResult } from './task-service';
