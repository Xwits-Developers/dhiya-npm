/**
 * Svelte Stores for Dhiya RAG Client
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import {
  DhiyaClient,
  DhiyaConfig,
  ClientStatus,
  Answer,
  AskOptions,
  KnowledgeSource,
  ProgressEvent
} from 'dhiya-npm';

export interface RAGStores {
  // Client instance
  client: Writable<DhiyaClient | null>;
  
  // Status stores
  status: Writable<ClientStatus | null>;
  initialized: Writable<boolean>;
  loading: Writable<boolean>;
  error: Writable<Error | null>;
  progress: Writable<ProgressEvent | null>;
  
  // Answer stores
  lastAnswer: Writable<Answer | null>;
  isAsking: Writable<boolean>;
  
  // Computed store
  isReady: Readable<boolean>;
  
  // Methods
  initialize: () => Promise<void>;
  loadKnowledge: (source: KnowledgeSource) => Promise<void>;
  ask: (query: string, options?: AskOptions) => Promise<Answer>;
  clear: () => Promise<void>;
  destroy: () => Promise<void>;
}

export interface CreateRAGStoresOptions extends DhiyaConfig {
  autoInitialize?: boolean;
}

export function createRAGStores(options: CreateRAGStoresOptions = {}): RAGStores {
  const { autoInitialize = false, ...config } = options;
  
  // Client instance (not reactive, managed internally)
  let clientInstance: DhiyaClient | null = null;
  
  // Reactive stores
  const client = writable<DhiyaClient | null>(null);
  const status = writable<ClientStatus | null>(null);
  const initialized = writable(false);
  const loading = writable(false);
  const error = writable<Error | null>(null);
  const progress = writable<ProgressEvent | null>(null);
  const lastAnswer = writable<Answer | null>(null);
  const isAsking = writable(false);
  
  // Derived store
  const isReady = derived(
    [initialized, loading],
    ([$initialized, $loading]) => $initialized && !$loading
  );
  
  // Initialize client
  const initialize = async () => {
    if (get(initialized)) return;
    
    try {
      loading.set(true);
      error.set(null);
      
      // Create client with callbacks
      if (!clientInstance) {
        clientInstance = new DhiyaClient({
          ...config,
          onProgress: (event: ProgressEvent) => {
            progress.set(event);
            config.onProgress?.(event);
          },
          onError: (err: Error) => {
            error.set(err);
            config.onError?.(err);
          }
        });
        client.set(clientInstance);
      }
      
      // Initialize
      await clientInstance.initialize();
      
      // Update status
      const newStatus = await clientInstance.getStatus();
      status.set(newStatus);
      initialized.set(true);
      
    } catch (err) {
      error.set(err instanceof Error ? err : new Error('Initialization failed'));
    } finally {
      loading.set(false);
    }
  };
  
  // Load knowledge
  const loadKnowledge = async (source: KnowledgeSource) => {
    if (!clientInstance) {
      throw new Error('Client not initialized');
    }
    
    try {
      loading.set(true);
      error.set(null);
      
      await clientInstance.loadKnowledge(source);
      
      // Update status
      const newStatus = await clientInstance.getStatus();
      status.set(newStatus);
      
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to load knowledge');
      error.set(errorObj);
      throw errorObj;
    } finally {
      loading.set(false);
    }
  };
  
  // Ask question
  const ask = async (query: string, askOptions?: AskOptions): Promise<Answer> => {
    if (!clientInstance) {
      throw new Error('Client not initialized');
    }
    
    try {
      isAsking.set(true);
      error.set(null);
      
      const answer = await clientInstance.ask(query, askOptions);
      lastAnswer.set(answer);
      
      return answer;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get answer');
      error.set(errorObj);
      throw errorObj;
    } finally {
      isAsking.set(false);
    }
  };
  
  // Clear knowledge base
  const clear = async () => {
    if (!clientInstance) {
      throw new Error('Client not initialized');
    }
    
    try {
      loading.set(true);
      await clientInstance.clear();
      
      const newStatus = await clientInstance.getStatus();
      status.set(newStatus);
      lastAnswer.set(null);
    } catch (err) {
      error.set(err instanceof Error ? err : new Error('Failed to clear'));
      throw err;
    } finally {
      loading.set(false);
    }
  };
  
  // Cleanup
  const destroy = async () => {
    if (clientInstance) {
      await clientInstance.destroy();
      clientInstance = null;
      client.set(null);
      initialized.set(false);
    }
  };
  
  // Auto-initialize
  if (autoInitialize) {
    initialize();
  }
  
  return {
    client,
    status,
    initialized,
    loading,
    error,
    progress,
    lastAnswer,
    isAsking,
    isReady,
    initialize,
    loadKnowledge,
    ask,
    clear,
    destroy
  };
}
