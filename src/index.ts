/**
 * Dhiya NPM - Client-side RAG Framework
 * Main entry point
 */

export { DhiyaClient } from './dhiya-client';

// Export types
export type {
  DhiyaConfig,
  KnowledgeSource,
  Answer,
  AskOptions,
  ClientStatus,
  SearchResult,
  Source,
  Chunk,
  ProgressEvent,
  LLMStatus
} from './core/types';

export {
  LLMProvider,
  ProgressType,
  EmbeddingModel,
  DeviceType
} from './core/types';

// Export LLM utilities
export { QueryType } from './llm/query-classifier';
export type { ILLMProvider } from './llm/base';

// Export utilities (optional, for advanced users)
export { cosineSimilarity } from './utils/similarity';
export { normalizeQuery, cleanText } from './utils/normalize';
export { detectCapabilities } from './utils/device';
