/**
 * Dhiya - Client-side RAG chatbot for the browser
 * Main entry point
 */

export { DhiyaClient } from './dhiya-client.js';

// Export types
export type {
  DhiyaConfig,
  KnowledgeSource,
  JSONKnowledgeSource,
  TextKnowledgeSource,
  URLKnowledgeSource,
  ArrayKnowledgeSource,
  Answer,
  AskOptions,
  ConversationTurn,
  ClientStatus,
  SearchResult,
  Source,
  Chunk,
  ProgressEvent,
  LLMStatus,
  LLMGenerateOptions,
  ChromeAIOptions,
  TransformersOptions
} from './core/types.js';

export {
  LLMProvider,
  ProgressType
} from './core/types.js';

export type { EmbeddingModel, DeviceType } from './core/types.js';

export type { LLMManagerOptions } from './llm/llm-manager.js';
export { LLMManager } from './llm/llm-manager.js';

export {
  DEFAULT_CONFIG,
  EMBEDDING_MODELS,
  TRANSFORMERS_MODELS
} from './core/config.js';

export {
  DEFAULT_CHROME_AI_OPTIONS,
  DEFAULT_TRANSFORMERS_OPTIONS
} from './llm/config.js';

// LLM utilities
export { QueryType, classifyQuery, isConversational, isOutOfScope } from './llm/query-classifier.js';
export type { ILLMProvider, LLMLoadProgress, LLMLoadProgressCallback } from './llm/base.js';

// Utilities for advanced users
export { cosineSimilarity } from './utils/similarity.js';
export { normalizeQuery, cleanText } from './utils/normalize.js';
export { detectCapabilities } from './utils/device.js';
export { chunkText, createChunks } from './rag/chunker.js';
export type { ChunkOptions } from './rag/chunker.js';
