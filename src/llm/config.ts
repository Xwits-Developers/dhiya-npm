/**
 * LLM Configuration
 */

/**
 * Transformers.js configuration (using DistilGPT-2)
 */
export const TRANSFORMERS_CONFIG = {
  // Model to use (DistilGPT-2 - smaller, faster)
  model: 'Xenova/distilgpt2',
  
  // System prompt
  systemPrompt: `You are a helpful AI assistant. Provide concise, accurate answers based on the given context. Be direct and helpful.`,
  
  // Environment settings
  allowLocalModels: false,
  useBrowserCache: true
};

/**
 * Generation parameters
 */
export const GENERATION_CONFIG = {
  maxTokens: 150,
  temperature: 0.7,
  topK: 50,
  topP: 0.9,
  repetitionPenalty: 1.2,
  doSample: true
};

/**
 * Chrome AI configuration
 */
export const CHROME_AI_CONFIG = {
  systemPrompt: `You are a helpful AI assistant. Provide clear, concise answers based on the context provided. If you don't know something, say so. Be professional and friendly.`,
  temperature: 0.7,
  topK: 3
};

/**
 * LLM timeout budgets (milliseconds)
 */
export const LLM_TIMEOUTS = {
  chromeAI: 5000,      // 5 seconds
  transformers: 10000,  // 10 seconds
  fallback: 2000       // 2 seconds for quick fallback
};

/**
 * When to use LLM enhancement
 */
export const LLM_USAGE_POLICY = {
  // High confidence = skip LLM (RAG is good enough)
  skipLLMThreshold: 0.75,
  
  // Medium confidence = quick LLM enhancement
  mediumConfidenceThreshold: 0.5,
  
  // Low confidence = full LLM with longer timeout
  lowConfidenceThreshold: 0.25
};
