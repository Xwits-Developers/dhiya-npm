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
  embedding?: number[];
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
  content?: string;  // Made optional for backward compat
  data?: string;      // Alternative property name
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
  topSource?: Source; // Highest similarity source (especially for singleAnswerMode)
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
  contextChunks?: string[];
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
  fallbackToRAGOnly?: boolean;
  
  // Hallucination controls
  strictRAG?: boolean;              // If true, never call LLM when retrieved context is small/low similarity
  minLLMSimilarity?: number;        // Minimum top similarity required before LLM enhancement
  minChunksForLLM?: number;         // Require at least this many chunks in KB before LLM can be used
  maxContextChars?: number;         // Max characters of context to pass into LLM
  
  // Answer formatting
  singleAnswerMode?: boolean;       // Return distilled top chunk only
  answerLengthLimit?: number;       // Character cap in single answer mode
  
  // Advanced options
  debug?: boolean;
  onProgress?: (event: ProgressEvent) => void;
  onError?: (error: Error) => void;
}

export type EmbeddingModel = 'english' | 'multilingual';
export type DeviceType = 'auto' | 'webgpu' | 'wasm' | 'cpu';

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
  sourceCount: number;  // Number of knowledge sources loaded
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
  useRewrite?: boolean;
  enableLLM?: boolean;
  timeout?: number; // milliseconds
  conversationHistory?: ConversationTurn[];
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
