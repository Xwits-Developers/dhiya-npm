/**
 * Integration tests for DhiyaClient.
 *
 * Embeddings are mocked with a DETERMINISTIC bag-of-words hash so that
 * retrieval ranking is meaningful: texts sharing vocabulary have high
 * cosine similarity, disjoint texts score ~0.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DhiyaClient } from '../dhiya-client';
import { KnowledgeSource } from '../core/types';

function deterministicEmbedding(text: string): Float32Array {
  const vec = new Float32Array(384);
  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vec[Math.abs(h) % 384] += 1;
  }
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async (task: string) => {
    if (task === 'feature-extraction') {
      return async (text: string) => ({ data: deterministicEmbedding(text) });
    }
    throw new Error(`Unexpected pipeline task in test: ${task}`);
  }),
  env: { allowLocalModels: false, useBrowserCache: false },
  TextStreamer: class {}
}));

let dbCounter = 0;

function freshClient(overrides: Record<string, unknown> = {}): DhiyaClient {
  return new DhiyaClient({
    debug: false,
    enableLLM: false,
    dbName: `test-db-${Date.now()}-${dbCounter++}`,
    ...overrides
  });
}

describe('DhiyaClient Integration', () => {
  let client: DhiyaClient;

  beforeEach(async () => {
    client = freshClient();
    await client.initialize();
  });

  afterEach(async () => {
    if (client) {
      await client.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const status = await client.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.embedding.ready).toBe(true);
    });

    it('should tolerate concurrent initialize calls', async () => {
      const c = freshClient();
      await Promise.all([c.initialize(), c.initialize(), c.initialize()]);
      const status = await c.getStatus();
      expect(status.initialized).toBe(true);
      await c.destroy();
    });

    it('should throw a clear error when used before initialize', async () => {
      const c = freshClient();
      await expect(c.ask('anything')).rejects.toThrow(/not initialized/i);
    });
  });

  describe('Knowledge Loading', () => {
    it('should load JSON knowledge', async () => {
      const source: KnowledgeSource = {
        type: 'json',
        data: [
          { title: 'AI', content: 'Artificial Intelligence is the simulation of human intelligence.' },
          { title: 'ML', content: 'Machine Learning enables systems to learn from data.' }
        ]
      };

      await client.loadKnowledge(source);

      const status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBeGreaterThan(0);
      expect(status.knowledgeBase.documentCount).toBe(1);
    });

    it('should load text knowledge', async () => {
      await client.loadKnowledge({
        type: 'text',
        data: 'This is a test document about artificial intelligence.'
      });

      const status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBeGreaterThan(0);
    });

    it('should manage multiple named documents', async () => {
      await client.loadKnowledge({ type: 'text', content: 'First document about pricing.', documentId: 'doc-a' });
      await client.loadKnowledge({ type: 'text', content: 'Second document about shipping.', documentId: 'doc-b' });

      const status = await client.getStatus();
      expect(status.knowledgeBase.documentCount).toBe(2);
    });

    it('regression: unnamed sources replace instead of duplicating', async () => {
      await client.loadKnowledge({ type: 'text', content: 'Version one of the docs about widgets.' });
      const first = await client.getStatus();

      // Same content again (e.g. page reload) -> no change
      await client.loadKnowledge({ type: 'text', content: 'Version one of the docs about widgets.' });
      const second = await client.getStatus();
      expect(second.knowledgeBase.chunkCount).toBe(first.knowledgeBase.chunkCount);
      expect(second.knowledgeBase.documentCount).toBe(1);

      // Updated content -> replaced, not appended
      await client.loadKnowledge({ type: 'text', content: 'Version two of the docs about widgets, now longer and better.' });
      const third = await client.getStatus();
      expect(third.knowledgeBase.documentCount).toBe(1);
    });

    it('should reject empty sources', async () => {
      await expect(client.loadKnowledge({ type: 'text', content: '   ' })).rejects.toThrow();
    });

    it('should remove documents', async () => {
      await client.loadKnowledge({ type: 'text', content: 'Removable content here.', documentId: 'temp' });
      await client.removeDocument('temp');

      const status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBe(0);
    });
  });

  describe('Question Answering', () => {
    beforeEach(async () => {
      await client.loadKnowledge({
        type: 'json',
        documentId: 'kb',
        data: [
          {
            title: 'Machine Learning',
            content: 'Machine learning is a subset of AI that enables systems to learn and improve from experience.'
          },
          {
            title: 'Refund Policy',
            content: 'Customers can request a refund within 30 days of purchase for a full reimbursement.'
          }
        ]
      });
    });

    it('should answer questions with the relevant chunk ranked first', async () => {
      const answer = await client.ask('What is machine learning?');

      expect(answer.text.length).toBeGreaterThan(0);
      expect(answer.sources.length).toBeGreaterThan(0);
      expect(answer.chunks[0].chunk.content).toContain('Machine learning');
    });

    it('should rank by topic, not insertion order', async () => {
      const answer = await client.ask('How do I request a refund?');
      expect(answer.chunks[0].chunk.content).toContain('refund');
    });

    it('should calculate confidence scores in [0, 1]', async () => {
      const answer = await client.ask('What is machine learning?');
      expect(answer.confidence).toBeGreaterThanOrEqual(0);
      expect(answer.confidence).toBeLessThanOrEqual(1);
    });

    it('should include timing information', async () => {
      const answer = await client.ask('What is machine learning?');
      expect(answer.timing).toHaveProperty('total');
      expect(answer.timing).toHaveProperty('retrieval');
      expect(answer.timing).toHaveProperty('generation');
      expect(answer.timing.total).toBeGreaterThanOrEqual(0);
    });

    it('should return the no-answer message for unrelated queries', async () => {
      const answer = await client.ask('zebras quantum harpsichord blockchain');
      expect(answer.sources.length).toBe(0);
      expect(answer.confidence).toBe(0);
      expect(answer.text).toContain("don't have enough information");
    });

    it('should stream extractive answers through onToken', async () => {
      const tokens: string[] = [];
      const answer = await client.ask('What is machine learning?', {
        onToken: t => tokens.push(t)
      });
      expect(tokens.join('')).toBe(answer.text);
    });

    it('should throw on empty queries', async () => {
      await expect(client.ask('   ')).rejects.toThrow(/empty/i);
    });

    it('should answer greetings without retrieval', async () => {
      const answer = await client.ask('hello!');
      expect(answer.sources.length).toBe(0);
      expect(answer.text.toLowerCase()).toContain('hello');
    });

    it('regression: questions containing "ty"/"hi" substrings hit retrieval', async () => {
      await client.loadKnowledge({
        type: 'text',
        documentId: 'warranty',
        content: 'The warranty covers manufacturing defects for two years from purchase.'
      });

      const answer = await client.ask('What does the warranty cover?');
      expect(answer.sources.length).toBeGreaterThan(0);
      expect(answer.text.toLowerCase()).toContain('warranty');
    });
  });

  describe('Answer cache', () => {
    it('regression: cache is invalidated when knowledge changes', async () => {
      await client.loadKnowledge({
        type: 'text',
        documentId: 'policy',
        content: 'The maximum upload size is 10 megabytes per file.'
      });
      const before = await client.ask('What is the maximum upload size?');
      expect(before.text).toContain('10 megabytes');

      await client.loadKnowledge({
        type: 'text',
        documentId: 'policy',
        content: 'The maximum upload size is 50 megabytes per file.'
      });
      const after = await client.ask('What is the maximum upload size?');
      expect(after.text).toContain('50 megabytes');
    });

    it('regression: no-answer responses are not cached', async () => {
      const miss = await client.ask('What is the parrot handling procedure?');
      expect(miss.confidence).toBe(0);

      await client.loadKnowledge({
        type: 'text',
        documentId: 'parrots',
        content: 'The parrot handling procedure requires gloves and calm movements.'
      });

      const hit = await client.ask('What is the parrot handling procedure?');
      expect(hit.sources.length).toBeGreaterThan(0);
      expect(hit.text).toContain('parrot');
    });

    it('regression: cache is not shared across different answer configs', async () => {
      const dbName = `test-db-shared-${Date.now()}-${dbCounter++}`;
      const query = 'What is the escalation path?';
      const knowledge = 'The escalation path is tier one, then tier two, then the duty manager.';

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const cacheHits = () =>
        logSpy.mock.calls.filter(call => String(call[0]).includes('Cache hit for query:')).length;

      const first = freshClient({
        dbName,
        debug: true,
        transformersOptions: { systemPrompt: 'Answer as persona A.' }
      });
      await first.initialize();
      await first.loadKnowledge({ type: 'text', documentId: 'ops', content: knowledge });

      await first.ask(query);
      expect(cacheHits()).toBe(0); // cold
      await first.ask(query);
      expect(cacheHits()).toBe(1); // same config, same query -> hit
      await first.destroy();

      // Same knowledge base, same query, different system prompt: the previous
      // answer was worded by a config that no longer applies, so it must not
      // be replayed.
      const second = freshClient({
        dbName,
        debug: true,
        transformersOptions: { systemPrompt: 'Answer as persona B.' }
      });
      await second.initialize();

      await second.ask(query);
      expect(cacheHits()).toBe(1); // still 1 — no hit for the new config
      await second.destroy();

      logSpy.mockRestore();
    });

    it('serves cached answers for repeated queries', async () => {
      await client.loadKnowledge({
        type: 'text',
        content: 'Support is available around the clock every day of the year.'
      });

      const first = await client.ask('When is support available?');
      const second = await client.ask('When is support available?');
      expect(second.text).toBe(first.text);
    });
  });

  describe('Search API', () => {
    it('returns raw scored results', async () => {
      await client.loadKnowledge({
        type: 'text',
        content: 'Elephants are the largest land animals on Earth.'
      });

      const results = await client.search('largest land animals elephants');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0].chunk.content).toContain('Elephants');
    });
  });

  describe('Clear Knowledge', () => {
    it('should clear knowledge base', async () => {
      await client.loadKnowledge({ type: 'text', data: 'Test data for clearing.' });

      let status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBeGreaterThan(0);

      await client.clear();

      status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBe(0);
      expect(status.knowledgeBase.documentCount).toBe(0);
    });
  });
});
