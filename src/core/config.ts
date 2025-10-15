/**
 * Default configuration for dhiya-npm
 */

import { ChromeAIOptions, DhiyaConfig, LLMProvider, TransformersOptions } from './types';
import { DEFAULT_CHROME_AI_OPTIONS, DEFAULT_TRANSFORMERS_OPTIONS } from '../llm/config';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Omit<DhiyaConfig, 'onProgress' | 'onError'>> = {
  // Storage
  dbName: 'dhiya-kb',
  cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxCacheSize: 100,
  
  // Embedding
  embeddingModel: 'english',
  device: 'auto',
  
  // Chunking
  chunkSize: 900,
  chunkOverlap: 120,
  
  // Retrieval
  topK: 5,
  similarityThreshold: 0.25,
  useDiversity: true,
  diversityThreshold: 0.95,
  
  // LLM
  enableLLM: true,
  preferredProvider: LLMProvider.CHROME_AI,
  transformersModel: DEFAULT_TRANSFORMERS_OPTIONS.model,
  transformersOptions: { ...DEFAULT_TRANSFORMERS_OPTIONS },
  chromeAIOptions: { ...DEFAULT_CHROME_AI_OPTIONS },
  llmFallbackOrder: [LLMProvider.CHROME_AI, LLMProvider.TRANSFORMERS],
  fallbackToRAGOnly: true,
  
  // Hallucination controls defaults
  strictRAG: true,
  minLLMSimilarity: 0.55,
  minChunksForLLM: 5,
  maxContextChars: 1800,
  
  // Answer formatting
  singleAnswerMode: true,
  answerLengthLimit: 320,
  
  // Advanced
  debug: false
};

/**
 * Embedding model configurations
 */
export const EMBEDDING_MODELS = {
  english: {
    name: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    maxTokens: 512,
    description: 'Fast, lightweight model for English text'
  },
  multilingual: {
    name: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    dimensions: 384,
    maxTokens: 512,
    description: 'Supports 50+ languages'
  }
} as const;

/**
 * Transformers.js model configurations
 */
export const TRANSFORMERS_MODELS = {
  'Xenova/gpt2': {
    name: 'GPT-2',
    size: '~500MB',
    speed: 'medium',
    quality: 'good',
    description: 'Reliable fallback model'
  },
  'Xenova/distilgpt2': {
    name: 'DistilGPT-2',
    size: '~250MB',
    speed: 'fast',
    quality: 'moderate',
    description: 'Smaller, faster variant'
  },
  'Xenova/Qwen2-0.5B-Instruct': {
    name: 'Qwen2 0.5B',
    size: '~150MB',
    speed: 'fast',
    quality: 'excellent',
    description: 'Best balance (if available)'
  }
} as const;

/**
 * Chunking configuration
 */
export const CHUNKING_CONFIG = {
  // Sentence boundaries to prioritize
  sentenceBoundaries: ['. ', '! ', '? ', '.\n', '!\n', '?\n'],
  
  // Paragraph boundaries
  paragraphBoundaries: ['\n\n', '\n\n\n'],
  
  // Minimum chunk size (avoid tiny chunks)
  minChunkSize: 100,
  
  // Maximum chunk size
  maxChunkSize: 1500
};

/**
 * Validation constraints
 */
export const VALIDATION_CONSTRAINTS = {
  minChunkSize: 50,
  maxChunkSize: 2000,
  minChunkOverlap: 0,
  maxChunkOverlap: 500,
  minTopK: 1,
  maxTopK: 50,
  minSimilarityThreshold: 0.0,
  maxSimilarityThreshold: 1.0,
  minCacheTTL: 60 * 1000, // 1 minute
  maxCacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  minCacheSize: 10,
  maxCacheSize: 1000
};

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  // High similarity = instant response without LLM enhancement
  highSimilarity: 0.75,
  
  // Medium similarity = try LLM with short timeout
  mediumSimilarity: 0.5,
  
  // Low similarity = longer LLM timeout or suggest rephrasing
  lowSimilarity: 0.25,
  
  // Timeout budgets (ms)
  llmTimeoutHigh: 2000,
  llmTimeoutMedium: 3000,
  llmTimeoutLow: 5000
};

/**
 * Storage limits
 */
export const STORAGE_LIMITS = {
  // Recommended max chunks in memory
  maxChunksInMemory: 10000,
  
  // Batch size for embedding
  embeddingBatchSize: 10,
  
  // IndexedDB quota warning threshold (bytes)
  quotaWarningThreshold: 50 * 1024 * 1024 // 50MB
};

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  NOT_INITIALIZED: 'DhiyaClient not initialized. Call initialize() first.',
  EMBEDDING_FAILED: 'Failed to initialize embedding model.',
  STORAGE_FAILED: 'Failed to initialize storage.',
  INVALID_SOURCE: 'Invalid knowledge source format.',
  INDEXING_FAILED: 'Failed to index knowledge base.',
  QUERY_EMPTY: 'Query cannot be empty.',
  LLM_UNAVAILABLE: 'LLM provider unavailable. Falling back to RAG-only.',
  NETWORK_ERROR: 'Network error while fetching knowledge source.',
  PARSE_ERROR: 'Failed to parse knowledge source data.'
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig?: DhiyaConfig): Required<DhiyaConfig> {
  const merged = {
    ...DEFAULT_CONFIG,
    ...userConfig
  };

  const transformersOptions: TransformersOptions = {
    ...DEFAULT_TRANSFORMERS_OPTIONS,
    ...(userConfig?.transformersOptions || {})
  };
  if (userConfig?.transformersModel) {
    transformersOptions.model = userConfig.transformersModel;
  }
  if (userConfig?.transformersOptions?.model) {
    transformersOptions.model = userConfig.transformersOptions.model;
  }
  merged.transformersOptions = transformersOptions;
  merged.transformersModel = transformersOptions.model;

  const chromeAIOptions: ChromeAIOptions = {
    ...DEFAULT_CHROME_AI_OPTIONS,
    ...(userConfig?.chromeAIOptions || {})
  };
  merged.chromeAIOptions = chromeAIOptions;

  merged.llmFallbackOrder = (userConfig?.llmFallbackOrder?.length
    ? userConfig.llmFallbackOrder
    : DEFAULT_CONFIG.llmFallbackOrder
  ).slice();
  
  // Validate and constrain values
  merged.chunkSize = Math.max(
    VALIDATION_CONSTRAINTS.minChunkSize,
    Math.min(VALIDATION_CONSTRAINTS.maxChunkSize, merged.chunkSize)
  );
  
  merged.chunkOverlap = Math.max(
    VALIDATION_CONSTRAINTS.minChunkOverlap,
    Math.min(VALIDATION_CONSTRAINTS.maxChunkOverlap, merged.chunkOverlap)
  );
  
  merged.topK = Math.max(
    VALIDATION_CONSTRAINTS.minTopK,
    Math.min(VALIDATION_CONSTRAINTS.maxTopK, merged.topK)
  );
  
  merged.similarityThreshold = Math.max(
    VALIDATION_CONSTRAINTS.minSimilarityThreshold,
    Math.min(VALIDATION_CONSTRAINTS.maxSimilarityThreshold, merged.similarityThreshold)
  );
  
  merged.cacheTTL = Math.max(
    VALIDATION_CONSTRAINTS.minCacheTTL,
    Math.min(VALIDATION_CONSTRAINTS.maxCacheTTL, merged.cacheTTL)
  );
  
  merged.maxCacheSize = Math.max(
    VALIDATION_CONSTRAINTS.minCacheSize,
    Math.min(VALIDATION_CONSTRAINTS.maxCacheSize, merged.maxCacheSize)
  );
  
  return merged as Required<DhiyaConfig>;
}
