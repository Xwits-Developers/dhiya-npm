import { ChromeAIOptions, TransformersOptions } from '../core/types.js';

const GROUNDED_SYSTEM_PROMPT =
  'You are a helpful assistant that answers questions using ONLY the provided context. ' +
  'Answer concisely in complete sentences. If the context does not contain the answer, ' +
  'say you do not have that information. Never invent facts.';

/**
 * Default Transformers.js options
 */
export const DEFAULT_TRANSFORMERS_OPTIONS: TransformersOptions = {
  model: 'onnx-community/Qwen2.5-0.5B-Instruct',
  systemPrompt: GROUNDED_SYSTEM_PROMPT,
  maxTokens: 256,
  temperature: 0.2,
  topK: 40,
  topP: 0.9,
  repetitionPenalty: 1.1,
  doSample: false,
  allowLocalModels: false,
  useBrowserCache: true,
  device: 'auto',
  dtype: 'q4'
};

/**
 * Default Chrome built-in AI options
 */
export const DEFAULT_CHROME_AI_OPTIONS: ChromeAIOptions = {
  systemPrompt: GROUNDED_SYSTEM_PROMPT
};

/**
 * LLM timeout budgets (milliseconds). Generation only — model download and
 * initialization are budgeted separately.
 */
export const LLM_TIMEOUTS = {
  chromeAI: 20000,
  transformers: 45000,
  /** One-time model download/initialization budget. */
  initialize: 300000
};
