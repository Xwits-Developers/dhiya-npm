/**
 * Main Dhiya Client - Orchestrates all components
 */

import { 
  DhiyaConfig, 
  KnowledgeSource, 
  Answer, 
  AskOptions,
  ClientStatus,
  ProgressType,
  LLMProvider
} from './core/types';
import { mergeConfig, ERROR_MESSAGES, PERFORMANCE_THRESHOLDS } from './core/config';
import { EmbeddingManager } from './rag/embeddings';
import { Retriever } from './rag/retriever';
import { synthesizeAnswer, formatAnswer, createLLMPrompt } from './rag/answerer';
import { createChunks } from './rag/chunker';
import { StorageManager } from './storage/indexeddb';
import { normalizeQuery, hashText } from './utils/normalize';
import { extractUrls } from './utils/normalize';
import { LLMManager } from './llm/llm-manager';
import { classifyQuery, shouldUseLLM, getConversationalResponse, getOutOfScopeResponse, QueryType } from './llm/query-classifier';

export class DhiyaClient {
  private config: Required<DhiyaConfig>;
  private embeddings: EmbeddingManager;
  private retriever: Retriever;
  private storage: StorageManager;
  private llm?: LLMManager;
  private initialized = false;
  
  constructor(config?: DhiyaConfig) {
    this.config = mergeConfig(config);
    this.embeddings = new EmbeddingManager(this.config.onProgress);
    this.retriever = new Retriever();
    this.storage = new StorageManager(this.config.dbName);
    
    // Initialize LLM if enabled
    if (this.config.enableLLM) {
      this.llm = new LLMManager(this.config.preferredProvider);
    }
  }
  
  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.emitProgress(ProgressType.INIT, 'Initializing Dhiya...', 0);
    
    try {
      // Initialize storage
      this.emitProgress(ProgressType.INIT, 'Initializing storage...', 20);
      await this.storage.initialize();
      
      // Clear expired cache
      await this.storage.clearExpiredCache(this.config.cacheTTL);
      await this.storage.limitCacheSize(this.config.maxCacheSize);
      
      // Initialize embeddings
      this.emitProgress(ProgressType.INIT, 'Loading embedding model...', 40);
      await this.embeddings.initialize(
        this.config.embeddingModel,
        this.config.device
      );
      
      // Load existing chunks
      this.emitProgress(ProgressType.INIT, 'Loading knowledge base...', 60);
      const chunks = await this.storage.getAllChunks();
      this.retriever.setChunks(chunks);
      
      // Initialize LLM in background (non-blocking)
      if (this.config.enableLLM && this.llm) {
        this.emitProgress(ProgressType.INIT, 'Initializing LLM...', 80);
        this.llm.initialize().catch(error => {
          if (this.config.debug) {
            console.warn('⚠️  LLM initialization failed, continuing with RAG-only:', error);
          }
        });
      }
      
      this.initialized = true;
      this.emitProgress(ProgressType.COMPLETE, 'Dhiya ready!', 100);
      
      if (this.config.debug) {
        console.log('✅ Dhiya initialized with', chunks.length, 'chunks');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emitProgress(ProgressType.ERROR, `Initialization failed: ${message}`, 0);
      throw error;
    }
  }
  
  /**
   * Load knowledge from a source
   */
  async loadKnowledge(source: KnowledgeSource): Promise<void> {
    this.ensureInitialized();
    
    try {
      const docId = source.documentId || `doc-${Date.now()}`;
      
      // Parse source into text
      let text: string;
      let metadata: Record<string, any> = {};
      
      switch (source.type) {
        case 'json':
          text = this.parseJSON(source.data);
          metadata = { type: 'json' };
          break;
        case 'text':
          text = source.content || source.data || '';
          metadata = { ...source.metadata, type: 'text' };
          break;
        case 'url':
          text = await this.fetchURL(source.url, source.selector);
          metadata = { type: 'url', url: source.url };
          break;
        case 'array':
          text = source.items.join('\n\n');
          metadata = { type: 'array' };
          break;
        default:
          throw new Error(ERROR_MESSAGES.INVALID_SOURCE);
      }
      
      // Check if document changed
      const checksum = await hashText(text);
      const existingManifest = await this.storage.getManifest(docId);
      
      if (existingManifest && existingManifest.checksum === checksum) {
        if (this.config.debug) {
          console.log(`Document ${docId} unchanged, skipping indexing`);
        }
        return;
      }
      
      // Delete old chunks if updating
      if (existingManifest) {
        await this.storage.deleteChunksByDocId(docId);
      }
      
      // Create chunks
      this.emitProgress(ProgressType.INDEXING, `Chunking document ${docId}...`, 0);
      const chunks = createChunks(text, docId, docId, {
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap
      }, metadata);
      
      // Embed chunks
      this.emitProgress(ProgressType.INDEXING, `Embedding ${chunks.length} chunks...`, 25);
      const embeddings = await this.embeddings.embedBatch(
        chunks.map(c => c.content),
        10 // batch size
      );
      
      // Attach embeddings
      chunks.forEach((chunk, i) => {
        chunk.embedding = embeddings[i];
      });
      
      // Save to storage
      this.emitProgress(ProgressType.INDEXING, 'Saving to storage...', 90);
      await this.storage.saveChunks(chunks);
      
      // Update manifest
      await this.storage.saveManifest({
        doc_id: docId,
        checksum,
        version: '1.0',
        updated: Date.now(),
        chunkCount: chunks.length
      });
      
      // Reload retriever
      const allChunks = await this.storage.getAllChunks();
      this.retriever.setChunks(allChunks);
      
      this.emitProgress(ProgressType.COMPLETE, `Indexed ${chunks.length} chunks`, 100);
      
      if (this.config.debug) {
        console.log(`✅ Indexed ${chunks.length} chunks from ${docId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_MESSAGES.INDEXING_FAILED;
      this.emitProgress(ProgressType.ERROR, message, 0);
      throw error;
    }
  }
  
  /**
   * Ask a question
   */
  async ask(query: string, options: AskOptions = {}): Promise<Answer> {
    this.ensureInitialized();
    
    if (!query.trim()) {
      throw new Error(ERROR_MESSAGES.QUERY_EMPTY);
    }
    
    const startTime = Date.now();
    const useLLM = options.enableLLM !== undefined ? options.enableLLM : this.config.enableLLM;
    
    try {
      // Classify query type
      const queryType = classifyQuery(query);
      
      // Handle conversational queries
      if (queryType === QueryType.CONVERSATIONAL) {
        const response = getConversationalResponse(query);
        return {
          text: response,
          sources: [],
          confidence: 1.0,
          chunks: [],
          provider: LLMProvider.NONE,
          timing: {
            retrieval: 0,
            generation: Date.now() - startTime,
            total: Date.now() - startTime
          }
        };
      }
      
      // Handle out of scope queries
      if (queryType === QueryType.OUT_OF_SCOPE) {
        const response = getOutOfScopeResponse();
        return {
          text: response,
          sources: [],
          confidence: 0,
          chunks: [],
          provider: LLMProvider.NONE,
          timing: {
            retrieval: 0,
            generation: Date.now() - startTime,
            total: Date.now() - startTime
          }
        };
      }
      
      // Normalize query
      const normalizedQuery = normalizeQuery(query);
      
      // Check cache
      const cached = await this.storage.getCachedAnswer(normalizedQuery);
      if (cached) {
        if (this.config.debug) {
          console.log('📦 Cache hit for query:', query);
        }
        return cached.answer;
      }
      
  // Embed query
      this.emitProgress(ProgressType.RETRIEVAL, 'Searching knowledge base...', 0);
      const queryEmbedding = await this.embeddings.embed(normalizedQuery);
      
      // Retrieve relevant chunks
      const results = await this.retriever.retrieve(queryEmbedding, {
        topK: options.topK || this.config.topK,
        threshold: this.config.similarityThreshold,
        useDiversity: this.config.useDiversity,
        diversityThreshold: this.config.diversityThreshold
      });
      
      const retrievalTime = Date.now() - startTime;
      
      // Synthesize answer from RAG
  const { text, sources, confidence } = synthesizeAnswer(query, results, {
        maxSources: 3,
        includeUrls: true,
        confidenceThreshold: 0.8
      });
      
      let finalText = text;
      let usedProvider: LLMProvider | undefined = undefined;
      
      // Optionally enhance with LLM
      const kbSize = this.retriever.getChunkCount();
      const topSimilarity = results[0]?.similarity || 0;
      const allowLLM = useLLM && this.llm && shouldUseLLM(queryType, useLLM);
      const llmPermitted = allowLLM &&
        kbSize >= this.config.minChunksForLLM &&
        topSimilarity >= (this.config.minLLMSimilarity || 0) &&
        (!this.config.strictRAG || confidence < PERFORMANCE_THRESHOLDS.highSimilarity);

      // Single answer mode OR definitional queries produce concise answer from top chunk
      const definitional = /^(what is|who is|define|explain)\b/i.test(query);
      if ((this.config.singleAnswerMode || definitional) && results.length > 0) {
        const top = results[0].chunk.content.trim();
        // First sentence
        finalText = top.split(/(?<=[.!?])\s+/)[0].trim();
        const limit = this.config.answerLengthLimit || 320;
        if (finalText.length > limit) finalText = finalText.slice(0, limit).trimEnd() + '…';
      }

      if (!definitional && llmPermitted && results.length > 0) {
        // Decide if we need LLM enhancement based on confidence
        const needsEnhancement = confidence < PERFORMANCE_THRESHOLDS.highSimilarity;
        
        if (needsEnhancement) {
          try {
            this.emitProgress(ProgressType.GENERATION, 'Enhancing with LLM...', 0);
            
            // Build trimmed context
            let context = results.slice(0, 3).map(r => r.chunk.content).join('\n\n');
            if (context.length > this.config.maxContextChars) {
              context = context.slice(0, this.config.maxContextChars) + '...';
            }
            const llmPrompt = createLLMPrompt(query, context, options.conversationHistory);
            
            const timeout = confidence < PERFORMANCE_THRESHOLDS.mediumSimilarity
              ? PERFORMANCE_THRESHOLDS.llmTimeoutLow
              : PERFORMANCE_THRESHOLDS.llmTimeoutMedium;
            
            const enhancedText = await (this.llm as any).generate(llmPrompt, {
              context,
              timeout
            });
            
            if (enhancedText && enhancedText.length > 50) {
              finalText = enhancedText;
              usedProvider = (this.llm as any).getActiveProvider() || undefined;
              
              if (this.config.debug) {
                console.log(`✨ Enhanced with ${usedProvider}`);
              }
            }
          } catch (error) {
            if (this.config.debug) {
              console.warn('⚠️  LLM enhancement failed, using RAG-only answer:', error);
            }
            // Continue with RAG-only answer
          }
        }
      }
      
      // Extract URLs and format
      const urls = extractUrls(results.map(r => r.chunk.content).join(' '));
  const formattedText = usedProvider || this.config.singleAnswerMode ? finalText : formatAnswer(finalText, sources, urls);
      
      // Add source links even for LLM-enhanced answers
      if (usedProvider && urls.length > 0) {
        const linkSection = '\n\n**Related links:**\n' + urls.slice(0, 5).map(url => `- ${url}`).join('\n');
        finalText = formattedText + linkSection;
      } else {
        finalText = formattedText;
      }
      
      const generationTime = Date.now() - startTime - retrievalTime;
      const totalTime = Date.now() - startTime;
      
      const answer: Answer = {
        text: usedProvider ? finalText : formattedText,
        sources: this.config.singleAnswerMode && sources.length > 0 ? [sources[0]] : sources,
        confidence,
        chunks: results,
        provider: usedProvider,
        timing: {
          retrieval: retrievalTime,
          generation: generationTime,
          total: totalTime
        },
        topSource: sources[0]
      };
      
      // Cache answer
      await this.storage.cacheAnswer(normalizedQuery, {
        query: normalizedQuery,
        answer,
        timestamp: Date.now()
      });
      
      // Maintain cache size
      await this.storage.limitCacheSize(this.config.maxCacheSize);
      
      this.emitProgress(ProgressType.COMPLETE, 'Answer generated', 100);
      
      return answer;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate answer';
      this.emitProgress(ProgressType.ERROR, message, 0);
      throw error;
    }
  }
  
  /**
   * Get current status
   */
  async getStatus(): Promise<ClientStatus> {
    const stats = this.initialized ? await this.storage.getStats() : {
      chunkCount: 0,
      cacheSize: 0,
      documentCount: 0
    };
    
    return {
      initialized: this.initialized,
      embedding: {
        ready: this.embeddings.ready(),
        model: this.embeddings.getModelName() || '',
        device: this.embeddings.getDevice(),
        loading: false
      },
      llm: this.llm ? this.llm.getStatus() : {
        available: false,
        provider: null,
        loading: false
      },
      storage: {
        ready: this.initialized,
        chunkCount: stats.chunkCount,
        cacheSize: stats.cacheSize
      },
      knowledgeBase: {
        documentCount: stats.documentCount,
        chunkCount: stats.chunkCount,
        sourceCount: stats.documentCount,  // Use documentCount as proxy for sources
        indexed: stats.chunkCount > 0
      }
    };
  }
  
  /**
   * Clear all knowledge
   */
  async clear(): Promise<void> {
    this.ensureInitialized();
    await this.storage.clearAll();
    this.retriever.setChunks([]);
    
    if (this.config.debug) {
      console.log('🗑️ Cleared all knowledge');
    }
  }
  
  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.embeddings.cleanup();
    if (this.llm) {
      await this.llm.cleanup();
    }
    await this.storage.close();
    this.initialized = false;
  }
  
  // Private helpers
  
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
    }
  }
  
  private emitProgress(type: ProgressType, message: string, progress?: number): void {
    if (this.config.onProgress) {
      this.config.onProgress({ type, message, progress });
    }
  }
  
  private parseJSON(data: object[] | object): string {
    if (Array.isArray(data)) {
      return data.map(item => this.jsonToText(item)).join('\n\n');
    }
    return this.jsonToText(data);
  }
  
  private jsonToText(obj: any): string {
    if (typeof obj === 'string') return obj;
    if (typeof obj !== 'object') return String(obj);
    
    let text = '';
    
    // Handle common KB formats
    if ('content' in obj) text += obj.content + '\n';
    if ('title' in obj) text += obj.title + '\n';
    if ('description' in obj) text += obj.description + '\n';
    
    // Handle entries array
    if ('entries' in obj && Array.isArray(obj.entries)) {
      text += obj.entries.map((e: any) => this.jsonToText(e)).join('\n\n');
    }
    
    return text.trim();
  }
  
  private async fetchURL(url: string, selector?: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      if (selector) {
        // Parse and extract content (simple implementation)
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const element = doc.querySelector(selector);
        return element?.textContent?.trim() || '';
      }
      
      // Extract text from HTML (simple)
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (error) {
      throw new Error(`${ERROR_MESSAGES.NETWORK_ERROR}: ${error}`);
    }
  }
}
