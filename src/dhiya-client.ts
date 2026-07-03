/**
 * Main Dhiya Client - orchestrates chunking, embeddings, retrieval,
 * storage, and local LLM answer generation.
 */

import {
  DhiyaConfig,
  KnowledgeSource,
  Answer,
  AskOptions,
  ClientStatus,
  ProgressType,
  LLMProvider,
  SearchResult,
  Source
} from './core/types.js';
import { mergeConfig, ERROR_MESSAGES } from './core/config.js';
import { EmbeddingManager } from './rag/embeddings.js';
import { Retriever } from './rag/retriever.js';
import { synthesizeAnswer, createLLMPrompt, extractFocusedSnippet, queryKeywords, extractAllUrls, formatAnswer } from './rag/answerer.js';
import { createChunks } from './rag/chunker.js';
import { StorageManager } from './storage/indexeddb.js';
import { normalizeQuery, hashText } from './utils/normalize.js';
import { LLMManager } from './llm/llm-manager.js';
import { classifyQuery, shouldUseLLM, getConversationalResponse, getOutOfScopeResponse, QueryType } from './llm/query-classifier.js';

/**
 * Bumped whenever chunking or embedding changes shape; documents indexed
 * under an older version are re-indexed even when their content checksum
 * is unchanged.
 */
const INDEX_VERSION = '2.1';

export class DhiyaClient {
  private config: Required<DhiyaConfig>;
  private embeddings: EmbeddingManager;
  private retriever: Retriever;
  private storage: StorageManager;
  private llm?: LLMManager;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config?: DhiyaConfig) {
    this.config = mergeConfig(config);
    this.embeddings = new EmbeddingManager(this.config.onProgress);
    this.retriever = new Retriever();
    this.storage = new StorageManager(this.config.dbName);

    if (this.config.enableLLM) {
      this.llm = new LLMManager({
        preferredProvider: this.config.preferredProvider,
        chromeAIOptions: { ...this.config.chromeAIOptions },
        transformersOptions: { ...this.config.transformersOptions },
        fallbackOrder: [...this.config.llmFallbackOrder],
        debug: this.config.debug
      });
    }
  }

  /**
   * Initialize the client. Safe to call multiple times / concurrently.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    this.emitProgress(ProgressType.INIT, 'Initializing Dhiya...', 0);

    try {
      this.emitProgress(ProgressType.INIT, 'Initializing storage...', 10);
      await this.storage.initialize();

      await this.storage.clearExpiredCache(this.config.cacheTTL);
      await this.storage.limitCacheSize(this.config.maxCacheSize);

      this.emitProgress(ProgressType.INIT, 'Loading embedding model...', 30);
      await this.embeddings.initialize(
        this.config.embeddingModel,
        this.config.device
      );

      this.emitProgress(ProgressType.INIT, 'Loading knowledge base...', 70);
      const chunks = await this.storage.getAllChunks();
      this.retriever.setChunks(chunks);

      // Warm up the LLM in the background (non-blocking)
      if (this.config.enableLLM && this.llm) {
        this.emitProgress(ProgressType.LLM_LOAD, 'Initializing LLM in background...', 85);
        this.llm.initialize().catch(error => {
          if (this.config.debug) {
            console.warn('LLM initialization failed, continuing with RAG-only:', error);
          }
        });
      }

      this.initialized = true;
      this.emitProgress(ProgressType.COMPLETE, 'Dhiya ready', 100);

      if (this.config.debug) {
        console.log('Dhiya initialized with', chunks.length, 'chunks');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emitProgress(ProgressType.ERROR, `Initialization failed: ${message}`, 0);
      throw error;
    }
  }

  /**
   * Load knowledge from a source.
   *
   * Document identity: pass `documentId` to manage multiple documents. When
   * omitted, URL sources use the URL as their id and other sources share the
   * id 'default' — re-loading without an id replaces the previous unnamed
   * document instead of duplicating it.
   */
  async loadKnowledge(source: KnowledgeSource): Promise<void> {
    this.ensureInitialized();

    try {
      const docId = source.documentId || (source.type === 'url' ? source.url : 'default');

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

      if (!text.trim()) {
        throw new Error(ERROR_MESSAGES.INVALID_SOURCE);
      }

      // Skip re-indexing when the content is unchanged
      const checksum = await hashText(text);
      const existingManifest = await this.storage.getManifest(docId);

      if (
        existingManifest &&
        existingManifest.checksum === checksum &&
        existingManifest.version === INDEX_VERSION
      ) {
        if (this.config.debug) {
          console.log(`Document ${docId} unchanged, skipping indexing`);
        }
        return;
      }

      if (existingManifest) {
        await this.storage.deleteChunksByDocId(docId);
      }

      this.emitProgress(ProgressType.INDEXING, `Chunking document ${docId}...`, 0);
      const chunks = createChunks(text, docId, docId, {
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
        // markdownAware=true → auto-detect (undefined); false → force plain text
        markdown: this.config.markdownAware ? undefined : false
      }, metadata);

      this.emitProgress(ProgressType.INDEXING, `Embedding ${chunks.length} chunks...`, 25);
      const embeddings = await this.embeddings.embedBatch(
        chunks.map(c => c.content)
      );

      chunks.forEach((chunk, i) => {
        chunk.embedding = embeddings[i];
      });

      this.emitProgress(ProgressType.INDEXING, 'Saving to storage...', 90);
      await this.storage.saveChunks(chunks);

      await this.storage.saveManifest({
        doc_id: docId,
        checksum,
        version: INDEX_VERSION,
        updated: Date.now(),
        chunkCount: chunks.length
      });

      // The knowledge base changed: cached answers may now be wrong
      await this.storage.clearCache();

      const allChunks = await this.storage.getAllChunks();
      this.retriever.setChunks(allChunks);

      this.emitProgress(ProgressType.COMPLETE, `Indexed ${chunks.length} chunks`, 100);

      if (this.config.debug) {
        console.log(`Indexed ${chunks.length} chunks from ${docId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_MESSAGES.INDEXING_FAILED;
      this.emitProgress(ProgressType.ERROR, message, 0);
      throw error;
    }
  }

  /**
   * Remove a previously loaded document and its chunks.
   */
  async removeDocument(docId: string): Promise<void> {
    this.ensureInitialized();
    await this.storage.deleteChunksByDocId(docId);
    await this.storage.deleteManifest(docId);
    await this.storage.clearCache();
    const allChunks = await this.storage.getAllChunks();
    this.retriever.setChunks(allChunks);
  }

  /**
   * Semantic search over the knowledge base. Returns raw scored chunks
   * without answer synthesis — useful for custom pipelines.
   */
  async search(query: string, options: { topK?: number; threshold?: number } = {}): Promise<SearchResult[]> {
    this.ensureInitialized();

    if (!query.trim()) {
      throw new Error(ERROR_MESSAGES.QUERY_EMPTY);
    }

    const normalized = normalizeQuery(query);
    const queryEmbedding = await this.embeddings.embed(normalized);
    return this.retriever.retrieve(queryEmbedding, {
      topK: options.topK ?? this.config.topK,
      threshold: options.threshold ?? this.config.similarityThreshold,
      useDiversity: this.config.useDiversity,
      diversityThreshold: this.config.diversityThreshold,
      hybrid: this.config.hybridSearch,
      keywordWeight: this.config.keywordWeight
    }, normalized);
  }

  /**
   * Ask a question. Streams incremental text via options.onToken when an
   * LLM provider is active; extractive answers arrive in a single call.
   */
  async ask(query: string, options: AskOptions = {}): Promise<Answer> {
    this.ensureInitialized();

    if (!query.trim()) {
      throw new Error(ERROR_MESSAGES.QUERY_EMPTY);
    }

    const startTime = Date.now();
    const useLLM = options.enableLLM !== undefined ? options.enableLLM : this.config.enableLLM;

    try {
      // Small-talk short-circuit (full-message matches only; see classifier)
      if (!this.config.disableQueryClassification) {
        const queryType = classifyQuery(query);

        if (queryType === QueryType.CONVERSATIONAL || queryType === QueryType.OUT_OF_SCOPE) {
          const response = queryType === QueryType.CONVERSATIONAL
            ? getConversationalResponse(query)
            : getOutOfScopeResponse();
          options.onToken?.(response);
          return this.buildShortCircuitAnswer(response, queryType, startTime);
        }
      }

      const normalizedQuery = normalizeQuery(query);

      // Answer cache (skipped when a caller wants streaming from scratch)
      if (!options.skipCache) {
        const cached = await this.storage.getCachedAnswer(normalizedQuery, this.config.cacheTTL);
        if (cached) {
          if (this.config.debug) {
            console.log('Cache hit for query:', query);
          }
          options.onToken?.(cached.answer.text);
          return cached.answer;
        }
      }

      // Retrieval
      this.emitProgress(ProgressType.RETRIEVAL, 'Searching knowledge base...', 0);
      const queryEmbedding = await this.embeddings.embed(normalizedQuery);

      const results = await this.retriever.retrieve(queryEmbedding, {
        topK: options.topK || this.config.topK,
        threshold: this.config.similarityThreshold,
        useDiversity: this.config.useDiversity,
        diversityThreshold: this.config.diversityThreshold,
        hybrid: this.config.hybridSearch,
        keywordWeight: this.config.keywordWeight
      }, normalizedQuery);

      const retrievalTime = Date.now() - startTime;

      // Extractive answer (always computed — it is the LLM fallback too)
      const synthesized = synthesizeAnswer(query, results, {
        maxSources: 3,
        noAnswerMessage: this.config.noAnswerMessage
      });

      let finalText = synthesized.text;
      let usedProvider: LLMProvider = LLMProvider.NONE;

      if (this.config.singleAnswerMode && results.length > 0) {
        // Focused snippet from the top chunk
        const snippet = extractFocusedSnippet(
          results[0].chunk.content,
          queryKeywords(query),
          this.config.answerLengthLimit
        );
        if (snippet) finalText = snippet;
      } else if (useLLM && this.llm && results.length > 0) {
        // Grounded LLM answer
        const topSimilarity = results[0].similarity;
        const classifiedType = this.config.disableQueryClassification
          ? QueryType.KNOWLEDGE_BASE
          : classifyQuery(query);
        const llmPermitted =
          shouldUseLLM(classifiedType, true) &&
          topSimilarity >= this.config.minLLMSimilarity;

        if (llmPermitted) {
          try {
            this.emitProgress(ProgressType.GENERATION, 'Generating answer...', 0);

            let context = results.slice(0, 3).map(r => r.chunk.content).join('\n\n');
            if (context.length > this.config.maxContextChars) {
              context = context.slice(0, this.config.maxContextChars) + '...';
            }
            const llmPrompt = createLLMPrompt(query, context, options.conversationHistory);

            const generated = await this.llm.generate(llmPrompt, {
              context,
              query,
              timeout: options.timeout,
              signal: options.signal,
              onToken: options.onToken
            });

            if (generated && generated.trim().length >= 2) {
              finalText = generated.trim();
              usedProvider = this.llm.getActiveProvider() || LLMProvider.NONE;

              if (this.config.debug && usedProvider !== LLMProvider.NONE) {
                console.log(`Answer generated with ${usedProvider}`);
              }
            }
          } catch (error) {
            if (this.config.debug) {
              console.warn('LLM generation failed, using extractive answer:', error);
            }
            // fall through to the extractive answer
          }
        }
      }

      // Append related links found in the retrieved chunks
      const urls = results.length > 0 ? extractAllUrls(results.slice(0, 3)) : [];
      finalText = formatAnswer(finalText, synthesized.sources, urls);

      // Callers streaming via onToken already received LLM tokens; for
      // extractive answers deliver the full text in one call.
      if (usedProvider === LLMProvider.NONE) {
        options.onToken?.(finalText);
      }

      const generationTime = Date.now() - startTime - retrievalTime;
      const totalTime = Date.now() - startTime;

      const answer: Answer = {
        text: finalText,
        sources: synthesized.sources,
        confidence: synthesized.confidence,
        chunks: results,
        provider: usedProvider,
        timing: {
          retrieval: retrievalTime,
          generation: generationTime,
          total: totalTime
        },
        topSource: synthesized.sources[0]
      };

      // Cache only useful answers (never the "no information" fallback)
      if (!options.skipCache && results.length > 0 && synthesized.confidence > 0) {
        await this.storage.cacheAnswer(normalizedQuery, {
          query: normalizedQuery,
          answer: this.slimAnswerForCache(answer),
          timestamp: Date.now()
        });
        await this.storage.limitCacheSize(this.config.maxCacheSize);
      }

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
        sourceCount: stats.documentCount,
        indexed: stats.chunkCount > 0
      }
    };
  }

  /**
   * Clear all knowledge (chunks, manifests, and cached answers)
   */
  async clear(): Promise<void> {
    this.ensureInitialized();
    await this.storage.clearAll();
    this.retriever.setChunks([]);

    if (this.config.debug) {
      console.log('Cleared all knowledge');
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

  private buildShortCircuitAnswer(text: string, queryType: QueryType, startTime: number): Answer {
    return {
      text,
      sources: [],
      confidence: queryType === QueryType.CONVERSATIONAL ? 1.0 : 0,
      chunks: [],
      provider: LLMProvider.NONE,
      timing: {
        retrieval: 0,
        generation: Date.now() - startTime,
        total: Date.now() - startTime
      }
    };
  }

  /**
   * Strip heavy fields (embeddings, full chunk bodies) before caching.
   */
  private slimAnswerForCache(answer: Answer): Answer {
    return {
      ...answer,
      chunks: answer.chunks.map(result => ({
        similarity: result.similarity,
        chunk: {
          id: result.chunk.id,
          doc_id: result.chunk.doc_id,
          source: result.chunk.source,
          content: result.chunk.content,
          metadata: result.chunk.metadata
          // embedding intentionally omitted
        }
      })),
      sources: answer.sources.map((s: Source) => ({ ...s }))
    };
  }

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
    if (typeof obj !== 'object' || obj === null) return String(obj);

    let text = '';

    if ('title' in obj) text += obj.title + '\n';
    if ('content' in obj) text += obj.content + '\n';
    if ('description' in obj) text += obj.description + '\n';

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

      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Never index script/style/head content
        doc.querySelectorAll('script, style, noscript, template').forEach(el => el.remove());

        const root = selector ? doc.querySelector(selector) : doc.body;
        return root?.textContent?.replace(/\s+\n/g, '\n').trim() || '';
      }

      // Non-DOM environment fallback: strip tags after removing script/style blocks
      return html
        .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (error) {
      throw new Error(`${ERROR_MESSAGES.NETWORK_ERROR}: ${error}`);
    }
  }
}
