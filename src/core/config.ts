/**
 * Default configuration for dhiya-npm
 */

import { ChromeAIOptions, DhiyaConfig, LLMProvider, TransformersOptions } from './types.js';
import { DEFAULT_CHROME_AI_OPTIONS, DEFAULT_TRANSFORMERS_OPTIONS } from '../llm/config.js';

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

  // Retrieval. The floor is deliberately permissive: chunks holding several
  // topics dilute cosine scores, and both the grounded LLM prompt and the
  // keyword-scored extractive path cope well with borderline matches.
  topK: 5,
  similarityThreshold: 0.2,
  useDiversity: true,
  diversityThreshold: 0.95,

  // LLM
  enableLLM: true,
  preferredProvider: LLMProvider.CHROME_AI,
  transformersModel: DEFAULT_TRANSFORMERS_OPTIONS.model,
  transformersOptions: { ...DEFAULT_TRANSFORMERS_OPTIONS },
  chromeAIOptions: { ...DEFAULT_CHROME_AI_OPTIONS },
  llmFallbackOrder: [
    LLMProvider.CHROME_AI,
    LLMProvider.CHROME_SUMMARIZER,
    LLMProvider.TRANSFORMERS
  ],

  // Answer quality
  minLLMSimilarity: 0.25,
  maxContextChars: 4000,
  singleAnswerMode: false,
  answerLengthLimit: 320,
  noAnswerMessage: "I don't have enough information in my knowledge base to answer that.",
  disableQueryClassification: false,

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
    description: 'Fast, lightweight model for English text (~25 MB download)'
  },
  multilingual: {
    name: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    dimensions: 384,
    maxTokens: 512,
    description: 'Supports 50+ languages (~120 MB download)'
  }
} as const;

/**
 * Known-good Transformers.js generation models
 */
export const TRANSFORMERS_MODELS = {
  'onnx-community/Qwen2.5-0.5B-Instruct': {
    name: 'Qwen2.5 0.5B Instruct',
    size: '~350MB (q4)',
    speed: 'fast on WebGPU, usable on WASM',
    quality: 'good',
    description: 'Default: small instruct model with solid grounded answers'
  },
  'HuggingFaceTB/SmolLM2-360M-Instruct': {
    name: 'SmolLM2 360M Instruct',
    size: '~270MB (q4)',
    speed: 'fast',
    quality: 'moderate',
    description: 'Smaller alternative for constrained devices'
  },
  'onnx-community/Llama-3.2-1B-Instruct': {
    name: 'Llama 3.2 1B Instruct',
    size: '~700MB (q4)',
    speed: 'medium (WebGPU recommended)',
    quality: 'best',
    description: 'Higher quality when bandwidth and memory allow'
  }
} as const;

/**
 * Chunking configuration
 */
export const CHUNKING_CONFIG = {
  minChunkSize: 100,
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
  // Above this similarity the extractive answer is trusted as-is
  highSimilarity: 0.75,
  mediumSimilarity: 0.5,
  lowSimilarity: 0.25,

  // Timeout budgets (ms) for LLM generation
  llmTimeoutLow: 30000,
  llmTimeoutMedium: 20000,
  llmTimeoutHigh: 15000
};

/**
 * Storage limits
 */
export const STORAGE_LIMITS = {
  maxChunksInMemory: 10000,
  embeddingBatchSize: 8,
  quotaWarningThreshold: 50 * 1024 * 1024 // 50MB
};

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  NOT_INITIALIZED: 'DhiyaClient not initialized. Call initialize() first.',
  EMBEDDING_FAILED: 'Failed to initialize embedding model.',
  STORAGE_FAILED: 'Failed to initialize storage.',
  STORAGE_UNAVAILABLE:
    'IndexedDB is not available in this environment. Dhiya must run in a browser context (it cannot run during SSR).',
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

  // Overlap must stay well below chunk size or chunking cannot make progress
  merged.chunkOverlap = Math.min(merged.chunkOverlap, Math.floor(merged.chunkSize / 2));

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
