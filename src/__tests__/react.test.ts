/**
 * Tests for the useRAG React hook (dhiya-npm/react).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useRAG } from '../react/index';

function deterministicEmbedding(text: string): Float32Array {
  const vec = new Float32Array(64);
  for (const token of text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vec[Math.abs(h) % 64] += 1;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map(v => v / norm) as Float32Array;
}

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async () => async (text: string) => ({ data: deterministicEmbedding(text) })),
  env: { allowLocalModels: false, useBrowserCache: false },
  TextStreamer: class {}
}));

let dbCounter = 0;

describe('useRAG', () => {
  beforeEach(() => {
    cleanup();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('initializes, loads knowledge, and reports ready', async () => {
    const { result } = renderHook(() =>
      useRAG({
        enableLLM: false,
        dbName: `react-test-${dbCounter++}`,
        knowledge: {
          type: 'text',
          documentId: 'kb',
          content: 'The warranty covers manufacturing defects for two years from purchase.'
        }
      })
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.ready).toBe(true), { timeout: 5000 });
    expect(result.current.error).toBeNull();
    expect(result.current.status?.knowledgeBase.chunkCount).toBeGreaterThan(0);
  });

  it('send() streams an answer into the messages array', async () => {
    const { result } = renderHook(() =>
      useRAG({
        enableLLM: false,
        dbName: `react-test-${dbCounter++}`,
        knowledge: {
          type: 'text',
          documentId: 'kb',
          content: 'The warranty covers manufacturing defects for two years from purchase.'
        }
      })
    );

    await waitFor(() => expect(result.current.ready).toBe(true), { timeout: 5000 });

    await act(async () => {
      await result.current.send('What does the warranty cover?');
    });

    const { messages } = result.current;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'What does the warranty cover?' });
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].pending).toBe(false);
    expect(messages[1].content.toLowerCase()).toContain('warranty');
    expect(messages[1].answer?.sources.length).toBeGreaterThan(0);
  });

  it('regression: concurrent send() calls stream into their own messages', async () => {
    const { result } = renderHook(() =>
      useRAG({
        enableLLM: false,
        dbName: `react-test-${dbCounter++}`,
        knowledge: {
          type: 'text',
          documentId: 'kb',
          content:
            'The warranty covers manufacturing defects for two years from purchase.\n\n' +
            'Refunds can be requested within 30 days of purchase for a full reimbursement.'
        }
      })
    );
    await waitFor(() => expect(result.current.ready).toBe(true), { timeout: 5000 });

    await act(async () => {
      // Fire both without awaiting the first — simulates a user sending a
      // second question while the first is still streaming.
      const p1 = result.current.send('What does the warranty cover?');
      const p2 = result.current.send('How can refunds be requested?');
      await Promise.all([p1, p2]);
    });

    const { messages } = result.current;
    expect(messages).toHaveLength(4);
    const assistants = messages.filter(m => m.role === 'assistant');
    expect(assistants).toHaveLength(2);
    // Each answer must land in its own turn's bubble
    expect(assistants[0].content.toLowerCase()).toContain('warranty');
    expect(assistants[1].content.toLowerCase()).toContain('refund');
    // Stable unique ids for React keys
    expect(new Set(messages.map(m => m.id)).size).toBe(4);
  });

  it('reset() clears the chat history', async () => {
    const { result } = renderHook(() =>
      useRAG({
        enableLLM: false,
        dbName: `react-test-${dbCounter++}`,
        knowledge: { type: 'text', content: 'Support is available 24 hours a day via chat.' }
      })
    );
    await waitFor(() => expect(result.current.ready).toBe(true), { timeout: 5000 });

    await act(async () => {
      await result.current.send('When is support available?');
    });
    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => result.current.reset());
    expect(result.current.messages).toHaveLength(0);
  });
});
