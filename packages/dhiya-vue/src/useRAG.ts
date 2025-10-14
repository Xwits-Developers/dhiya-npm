/**
 * Vue 3 Composable for Dhiya RAG Client
 */

import { ref, onMounted, onUnmounted, Ref, computed, ComputedRef } from 'vue';
import {
  DhiyaClient,
  DhiyaConfig,
  ClientStatus,
  Answer,
  AskOptions,
  KnowledgeSource,
  ProgressEvent
} from 'dhiya-npm';

export interface UseRAGOptions extends DhiyaConfig {
  autoInitialize?: boolean;
}

export interface UseRAGReturn {
  // Client instance
  client: Ref<DhiyaClient | null>;
  
  // Status
  status: Ref<ClientStatus | null>;
  initialized: Ref<boolean>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  
  // Progress
  progress: Ref<ProgressEvent | null>;
  
  // Methods
  initialize: () => Promise<void>;
  loadKnowledge: (source: KnowledgeSource) => Promise<void>;
  ask: (query: string, options?: AskOptions) => Promise<Answer>;
  clear: () => Promise<void>;
  
  // State
  lastAnswer: Ref<Answer | null>;
  isAsking: Ref<boolean>;
  
  // Computed
  isReady: ComputedRef<boolean>;
}

export function useRAG(options: UseRAGOptions = {}): UseRAGReturn {
  const { autoInitialize = true, ...config } = options;
  
  // Client instance
  let clientInstance: DhiyaClient | null = null;
  const client = ref<DhiyaClient | null>(null);
  
  // State
  const status = ref<ClientStatus | null>(null);
  const initialized = ref(false);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const progress = ref<ProgressEvent | null>(null);
  const lastAnswer = ref<Answer | null>(null);
  const isAsking = ref(false);
  
  // Computed
  const isReady = computed(() => initialized.value && !loading.value);
  
  // Initialize client
  const initialize = async () => {
    if (initialized.value) return;
    
    try {
      loading.value = true;
      error.value = null;
      
      // Create client with progress callback
      if (!clientInstance) {
        clientInstance = new DhiyaClient({
          ...config,
          onProgress: (event: ProgressEvent) => {
            progress.value = event;
            config.onProgress?.(event);
          },
          onError: (err: Error) => {
            error.value = err;
            config.onError?.(err);
          }
        });
        client.value = clientInstance;
      }
      
      // Initialize
      await clientInstance.initialize();
      
      // Update status
      const newStatus = await clientInstance.getStatus();
      status.value = newStatus;
      initialized.value = true;
      
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Initialization failed');
    } finally {
      loading.value = false;
    }
  };
  
  // Load knowledge
  const loadKnowledge = async (source: KnowledgeSource) => {
    if (!clientInstance) {
      throw new Error('Client not initialized');
    }
    
    try {
      loading.value = true;
      error.value = null;
      
      await clientInstance.loadKnowledge(source);
      
      // Update status
      const newStatus = await clientInstance.getStatus();
      status.value = newStatus;
      
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to load knowledge');
      throw err;
    } finally {
      loading.value = false;
    }
  };
  
  // Ask question
  const ask = async (query: string, askOptions?: AskOptions): Promise<Answer> => {
    if (!clientInstance) {
      throw new Error('Client not initialized');
    }
    
    try {
      isAsking.value = true;
      error.value = null;
      
      const answer = await clientInstance.ask(query, askOptions);
      lastAnswer.value = answer;
      
      return answer;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to get answer');
      error.value = errorObj;
      throw errorObj;
    } finally {
      isAsking.value = false;
    }
  };
  
  // Clear knowledge base
  const clear = async () => {
    if (!clientInstance) {
      throw new Error('Client not initialized');
    }
    
    try {
      loading.value = true;
      await clientInstance.clear();
      
      const newStatus = await clientInstance.getStatus();
      status.value = newStatus;
      lastAnswer.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to clear');
      throw err;
    } finally {
      loading.value = false;
    }
  };
  
  // Auto-initialize
  onMounted(() => {
    if (autoInitialize) {
      initialize();
    }
  });
  
  // Cleanup on unmount
  onUnmounted(() => {
    if (clientInstance) {
      clientInstance.destroy().catch(console.error);
    }
  });
  
  return {
    client,
    status,
    initialized,
    loading,
    error,
    progress,
    initialize,
    loadKnowledge,
    ask,
    clear,
    lastAnswer,
    isAsking,
    isReady
  };
}
