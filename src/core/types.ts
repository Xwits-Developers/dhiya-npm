/**
 * Core types for dhiya-npm
 */

// ============================================================================
// Knowledge Base Types
// ============================================================================

export interface KBEntry {
  id: string;
  title?: string;
  content: string;
  metadata?: Record<string, any>;
  source?: string;
}

export interface KBDocument {
  doc_id: string;
  version?: string;
  entries: KBEntry[];
  metadata?: Record<string, any>;
}

export interface Chunk {
  id: string;
  doc_id: string;
  source: string;
  content: string;
  /** Stored as Float32Array in IndexedDB; plain arrays are accepted on input. */
  embedding?: Float32Array | number[];
  metadata?: Record<string, any>;
}

// ============================================================================
// Knowledge Source Types
// ============================================================================

export type KnowledgeSource =
  | JSONKnowledgeSource
  | TextKnowledgeSource
  | URLKnowledgeSource
  | ArrayKnowledgeSource;

export interface JSONKnowledgeSource {
  type: 'json';
  data: object[] | object;
  documentId?: string;
}

export interface TextKnowledgeSource {
  type: 'text';
  content?: string;
  data?: string; // alternative property name, kept for compatibility
  documentId?: string;
  metadata?: Record<string, any>;
}

export interface URLKnowledgeSource {
  type: 'url';
  url: string;
  selector?: string; // CSS selector for content extraction
  documentId?: string;
}

export interface ArrayKnowledgeSource {
  type: 'array';
  items: string[];
  documentId?: string;
}

// ============================================================================
// Search & Retrieval Types
// ============================================================================

export interface SearchResult {
  chunk: Chunk;
  similarity: number;
}

export interface RetrievalOptions {
  topK?: number;
  threshold?: number;
  useDiversity?: boolean;
  diversityThreshold?: number;
}

// ============================================================================
// Answer Types
// ============================================================================

export interface Answer {
  text: string;
  sources: Source[];
  confidence: number;
  chunks: SearchResult[];
  provider?: LLMProvider;
  timing: TimingInfo;
  metadata?: Record<string, any>;
  /** Highest-similarity source, when any source matched. */
  topSource?: Source;
}

export interface Source {
  id: string;
  title?: string;
  content: string;
  url?: string;
  similarity: number;
}

export interface TimingInfo {
  retrieval: number;
  generation: number;
  total: number;
}

// ============================================================================
// LLM Types
// ============================================================================

export enum LLMProvider {
  CHROME_AI = 'chrome-ai',
  TRANSFORMERS = 'transformers',
  NONE = 'none'
}

export interface LLMStatus {
  available: boolean;
  provider: LLMProvider | null;
  loading: boolean;
  error?: string;
}

export interface LLMGenerateOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  context?: string;
  timeout?: number;
  /** Called with each new text fragment as the model generates it. */
  onToken?: (token: string) => void;
}

export interface ChromeAIOptions {
  systemPrompt: string;
  temperature?: number;
  topK?: number;
}

export interface TransformersOptions {
  model: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  topK: number;
  topP: number;
  repetitionPenalty: number;
  doSample: boolean;
  allowLocalModels: boolean;
  useBrowserCache: boolean;
  /** 'auto' picks WebGPU when available, falling back to WASM. */
  device?: 'auto' | 'webgpu' | 'wasm';
  /** Quantization of the generation model, e.g. 'q4', 'q4f16', 'fp16', 'fp32'. */
  dtype?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface DhiyaConfig {
  // Storage configuration
  dbName?: string;
  cacheTTL?: number; // milliseconds
  maxCacheSize?: number; // number of entries

  // Embedding configuration
  embeddingModel?: EmbeddingModel;
  device?: DeviceType;

  // Chunking configuration
  chunkSize?: number; // characters
  chunkOverlap?: number; // characters

  // Retrieval configuration
  topK?: number;
  similarityThreshold?: number;
  useDiversity?: boolean;
  diversityThreshold?: number;

  // LLM configuration
  enableLLM?: boolean;
  preferredProvider?: LLMProvider;
  transformersModel?: string;
  transformersOptions?: Partial<TransformersOptions>;
  chromeAIOptions?: Partial<ChromeAIOptions>;
  llmFallbackOrder?: LLMProvider[];

  // Answer quality controls
  /** Minimum top-chunk similarity before the LLM is asked to answer. */
  minLLMSimilarity?: number;
  /** Max characters of retrieved context passed to the LLM. */
  maxContextChars?: number;
  /** Return only a focused snippet from the top chunk (no LLM, no synthesis). */
  singleAnswerMode?: boolean;
  /** Character cap for singleAnswerMode snippets. */
  answerLengthLimit?: number;
  /** Message returned when nothing relevant is found in the knowledge base. */
  noAnswerMessage?: string;
  /** Skip the greeting/small-talk classifier and always run retrieval. */
  disableQueryClassification?: boolean;

  // Advanced options
  debug?: boolean;
  onProgress?: (event: ProgressEvent) => void;
  onError?: (error: Error) => void;
}

export type EmbeddingModel = 'english' | 'multilingual';
export type DeviceType = 'auto' | 'webgpu' | 'wasm';

// ============================================================================
// Status & Progress Types
// ============================================================================

export interface ClientStatus {
  initialized: boolean;
  embedding: EmbeddingStatus;
  llm: LLMStatus;
  storage: StorageStatus;
  knowledgeBase: KBStatus;
}

export interface EmbeddingStatus {
  ready: boolean;
  model: string;
  device: DeviceType;
  loading: boolean;
  error?: string;
}

export interface StorageStatus {
  ready: boolean;
  chunkCount: number;
  cacheSize: number;
  error?: string;
}

export interface KBStatus {
  documentCount: number;
  chunkCount: number;
  sourceCount: number;
  indexed: boolean;
  lastUpdated?: number;
}

export interface ProgressEvent {
  type: ProgressType;
  message: string;
  progress?: number; // 0-100
  metadata?: Record<string, any>;
}

export enum ProgressType {
  INIT = 'init',
  EMBEDDING_LOAD = 'embedding_load',
  LLM_LOAD = 'llm_load',
  INDEXING = 'indexing',
  RETRIEVAL = 'retrieval',
  GENERATION = 'generation',
  COMPLETE = 'complete',
  ERROR = 'error'
}

// ============================================================================
// Query Types
// ============================================================================

export interface AskOptions {
  topK?: number;
  enableLLM?: boolean;
  /** Milliseconds allowed for LLM generation before falling back to the extractive answer. */
  timeout?: number;
  conversationHistory?: ConversationTurn[];
  /** Called with incremental text as the answer is generated (LLM providers stream; extractive answers arrive in one call). */
  onToken?: (token: string) => void;
  /** Skip the answer cache for this query. */
  skipCache?: boolean;
}

export interface ConversationTurn {
  query: string;
  answer: string;
  timestamp: number;
}

// ============================================================================
// Internal Types (for implementation)
// ============================================================================

export interface ManifestEntry {
  doc_id: string;
  checksum: string;
  version: string;
  updated: number;
  chunkCount: number;
}

export interface CacheEntry {
  query: string;
  answer: Answer;
  timestamp: number;
}
