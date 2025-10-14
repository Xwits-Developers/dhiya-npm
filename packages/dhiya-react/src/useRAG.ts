/**
 * React Hook for Dhiya RAG Client
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  client: DhiyaClient | null;
  
  // Status
  status: ClientStatus | null;
  initialized: boolean;
  loading: boolean;
  error: Error | null;
  
  // Progress
  progress: ProgressEvent | null;
  
  // Methods
  initialize: () => Promise<void>;
  loadKnowledge: (source: KnowledgeSource) => Promise<void>;
  ask: (query: string, options?: AskOptions) => Promise<Answer>;
  clear: () => Promise<void>;
  
  // State
  lastAnswer: Answer | null;
  isAsking: boolean;
}

export function useRAG(options: UseRAGOptions = {}): UseRAGReturn {
  const { autoInitialize = true, ...config } = options;
  
  // Client instance (preserved across renders)
  const clientRef = useRef<DhiyaClient | null>(null);
  
  // State
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [lastAnswer, setLastAnswer] = useState<Answer | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  
  // Initialize client
  const initialize = useCallback(async () => {
    if (initialized) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Create client with progress callback
      if (!clientRef.current) {
        clientRef.current = new DhiyaClient({
          ...config,
          onProgress: (event) => {
            setProgress(event);
            config.onProgress?.(event);
          },
          onError: (err) => {
            setError(err);
            config.onError?.(err);
          }
        });
      }
      
      // Initialize
      await clientRef.current.initialize();
      
      // Update status
      const newStatus = await clientRef.current.getStatus();
      setStatus(newStatus);
      setInitialized(true);
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Initialization failed'));
    } finally {
      setLoading(false);
    }
  }, [initialized, config]);
  
  // Load knowledge
  const loadKnowledge = useCallback(async (source: KnowledgeSource) => {
    if (!clientRef.current) {
      throw new Error('Client not initialized');
    }
    
    try {
      setLoading(true);
      setError(null);
      
      await clientRef.current.loadKnowledge(source);
      
      // Update status
      const newStatus = await clientRef.current.getStatus();
      setStatus(newStatus);
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load knowledge'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Ask question
  const ask = useCallback(async (query: string, askOptions?: AskOptions): Promise<Answer> => {
    if (!clientRef.current) {
      throw new Error('Client not initialized');
    }
    
    try {
      setIsAsking(true);
      setError(null);
      
      const answer = await clientRef.current.ask(query, askOptions);
      setLastAnswer(answer);
      
      return answer;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get answer');
      setError(error);
      throw error;
    } finally {
      setIsAsking(false);
    }
  }, []);
  
  // Clear knowledge base
  const clear = useCallback(async () => {
    if (!clientRef.current) {
      throw new Error('Client not initialized');
    }
    
    try {
      setLoading(true);
      await clientRef.current.clear();
      
      const newStatus = await clientRef.current.getStatus();
      setStatus(newStatus);
      setLastAnswer(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to clear'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Auto-initialize
  useEffect(() => {
    if (autoInitialize && !initialized && !loading) {
      initialize();
    }
  }, [autoInitialize, initialized, loading, initialize]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.destroy().catch(console.error);
      }
    };
  }, []);
  
  return {
    client: clientRef.current,
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
    isAsking
  };
}
