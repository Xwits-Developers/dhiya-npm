/**
 * React bindings for Dhiya — `dhiya-npm/react`.
 *
 * `useRAG` owns a DhiyaClient's lifecycle: it creates and initializes the
 * client once (StrictMode-safe), exposes ready/loading/error/status, and
 * gives you streaming `ask` plus a message-list helper for chat UIs.
 *
 * React is an optional peer dependency — only import this entry from a React
 * app. Written with hooks only (no JSX) so it needs no JSX build step.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DhiyaClient } from '../dhiya-client.js';
import type {
  DhiyaConfig,
  KnowledgeSource,
  Answer,
  AskOptions,
  ClientStatus
} from '../core/types.js';

export interface ChatMessage {
  /** Stable identity for the message — safe to use as a React key. */
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Present on assistant messages once the answer resolves. */
  answer?: Answer;
  /** True while an assistant message is still streaming. */
  pending?: boolean;
}

let messageCounter = 0;
function nextMessageId(): string {
  return `dhiya-msg-${++messageCounter}`;
}

export interface UseRAGOptions extends DhiyaConfig {
  /**
   * Knowledge to load automatically after initialization.
   * Captured when the client mounts — changing this prop later has no
   * effect; call `loadKnowledge()` from the hook result instead.
   */
  knowledge?: KnowledgeSource | KnowledgeSource[];
  /** Start initializing immediately on mount (default true). */
  autoInitialize?: boolean;
}

export interface UseRAGResult {
  client: DhiyaClient | null;
  ready: boolean;
  loading: boolean;
  error: Error | null;
  status: ClientStatus | null;
  /** Streaming chat history built by `send`. */
  messages: ChatMessage[];
  /** Ask a question and return the full Answer (does not touch `messages`). */
  ask: (query: string, options?: AskOptions) => Promise<Answer>;
  /** Ask and stream into `messages` as a chat turn. */
  send: (query: string, options?: AskOptions) => Promise<Answer | null>;
  /** Ingest more knowledge at runtime. */
  loadKnowledge: (source: KnowledgeSource) => Promise<void>;
  /** Clear the local chat history. */
  reset: () => void;
  /** Refresh the cached status snapshot. */
  refreshStatus: () => Promise<void>;
}

/**
 * Manage a Dhiya client in a React component.
 */
export function useRAG(options: UseRAGOptions = {}): UseRAGResult {
  const { knowledge, autoInitialize = true, ...config } = options;

  const clientRef = useRef<DhiyaClient | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(autoInitialize);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Config is captured once on first render; changing it later does not
  // recreate the client (matching how a RAG client is used in practice).
  const configRef = useRef(config);
  const knowledgeRef = useRef(knowledge);
  knowledgeRef.current = knowledge;

  useEffect(() => {
    if (!autoInitialize) return;

    let cancelled = false;
    const client = new DhiyaClient(configRef.current);
    clientRef.current = client;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        await client.initialize();
        const kb = knowledgeRef.current;
        if (kb) {
          const sources = Array.isArray(kb) ? kb : [kb];
          for (const source of sources) {
            if (cancelled) return;
            await client.loadKnowledge(source);
          }
        }
        if (cancelled) return;
        setReady(true);
        try {
          setStatus(await client.getStatus());
        } catch {
          /* status is best-effort */
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // Reset the ref so a StrictMode remount creates a fresh client.
      clientRef.current = null;
      setReady(false);
      void client.destroy();
    };
    // Config/knowledge are captured via refs; the client is created once.
  }, [autoInitialize]);

  const ask = useCallback(async (query: string, opts?: AskOptions): Promise<Answer> => {
    const client = clientRef.current;
    if (!client) throw new Error('Dhiya client is not ready yet');
    return client.ask(query, opts);
  }, []);

  const send = useCallback(async (query: string, opts?: AskOptions): Promise<Answer | null> => {
    const client = clientRef.current;
    if (!client || !query.trim()) return null;

    // Each turn patches its own assistant message by id, so concurrent
    // send() calls stream into the right bubbles.
    const assistantId = nextMessageId();
    setMessages(prev => [
      ...prev,
      { id: nextMessageId(), role: 'user', content: query },
      { id: assistantId, role: 'assistant', content: '', pending: true }
    ]);

    let streamed = '';
    const updateAssistant = (patch: Partial<ChatMessage>) => {
      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, ...patch } : m))
      );
    };

    try {
      const answer = await client.ask(query, {
        ...opts,
        onToken: token => {
          streamed += token;
          updateAssistant({ content: streamed, pending: true });
          opts?.onToken?.(token);
        }
      });
      updateAssistant({ content: answer.text, answer, pending: false });
      return answer;
    } catch (err) {
      updateAssistant({
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        pending: false
      });
      return null;
    }
  }, []);

  const loadKnowledge = useCallback(async (source: KnowledgeSource) => {
    const client = clientRef.current;
    if (!client) throw new Error('Dhiya client is not ready yet');
    await client.loadKnowledge(source);
    try {
      setStatus(await client.getStatus());
    } catch {
      /* best-effort */
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      setStatus(await client.getStatus());
    } catch {
      /* best-effort */
    }
  }, []);

  const reset = useCallback(() => setMessages([]), []);

  return useMemo(
    () => ({
      client: clientRef.current,
      ready,
      loading,
      error,
      status,
      messages,
      ask,
      send,
      loadKnowledge,
      reset,
      refreshStatus
    }),
    [ready, loading, error, status, messages, ask, send, loadKnowledge, reset, refreshStatus]
  );
}

export { DhiyaClient };
export type { DhiyaConfig, KnowledgeSource, Answer, AskOptions, ClientStatus } from '../core/types.js';
