/**
 * Storage layer tests (runs against fake-indexeddb).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '../storage/indexeddb';
import { Answer, CacheEntry, Chunk, LLMProvider } from '../core/types';

let dbCounter = 0;

function makeAnswer(text: string): Answer {
  return {
    text,
    sources: [],
    confidence: 0.9,
    chunks: [],
    provider: LLMProvider.NONE,
    timing: { retrieval: 1, generation: 1, total: 2 }
  };
}

function makeEntry(query: string, timestamp = Date.now()): CacheEntry {
  return { query, answer: makeAnswer(`answer for ${query}`), timestamp };
}

describe('StorageManager', () => {
  let storage: StorageManager;

  beforeEach(async () => {
    storage = new StorageManager(`storage-test-${Date.now()}-${dbCounter++}`);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('tolerates concurrent initialize calls', async () => {
    const s = new StorageManager(`storage-race-${Date.now()}-${dbCounter++}`);
    await Promise.all([s.initialize(), s.initialize(), s.initialize()]);
    const stats = await s.getStats();
    expect(stats.chunkCount).toBe(0);
    await s.close();
  });

  it('round-trips chunks with Float32Array embeddings', async () => {
    const chunk: Chunk = {
      id: 'c1',
      doc_id: 'doc',
      source: 'doc#chunk-0',
      content: 'hello world',
      embedding: Float32Array.from([0.1, 0.2, 0.3])
    };

    await storage.saveChunks([chunk]);
    const all = await storage.getAllChunks();

    expect(all).toHaveLength(1);
    expect(all[0].embedding).toBeInstanceOf(Float32Array);
    expect(Array.from(all[0].embedding as Float32Array).map(v => +v.toFixed(4))).toEqual([0.1, 0.2, 0.3]);
  });

  it('converts plain-array embeddings to Float32Array on save', async () => {
    await storage.saveChunks([
      { id: 'c1', doc_id: 'doc', source: 's', content: 'x', embedding: [1, 2, 3] }
    ]);
    const all = await storage.getAllChunks();
    expect(all[0].embedding).toBeInstanceOf(Float32Array);
  });

  it('deletes chunks by document id', async () => {
    await storage.saveChunks([
      { id: 'a-0', doc_id: 'a', source: 's', content: 'one' },
      { id: 'a-1', doc_id: 'a', source: 's', content: 'two' },
      { id: 'b-0', doc_id: 'b', source: 's', content: 'three' }
    ]);

    await storage.deleteChunksByDocId('a');
    const remaining = await storage.getAllChunks();
    expect(remaining.map(c => c.id)).toEqual(['b-0']);
  });

  describe('answer cache', () => {
    it('enforces TTL on read', async () => {
      const stale = makeEntry('old query', Date.now() - 60 * 60 * 1000);
      await storage.cacheAnswer(stale.query, stale);

      // TTL of 1 minute: the hour-old entry must not be served
      const result = await storage.getCachedAnswer('old query', 60 * 1000);
      expect(result).toBeUndefined();

      // ...and it should have been deleted
      const again = await storage.getCachedAnswer('old query', 24 * 60 * 60 * 1000);
      expect(again).toBeUndefined();
    });

    it('serves entries within TTL and refreshes their timestamp (LRU)', async () => {
      const entry = makeEntry('popular query', Date.now() - 30 * 1000);
      await storage.cacheAnswer(entry.query, entry);

      const hit = await storage.getCachedAnswer('popular query', 60 * 1000);
      expect(hit).toBeDefined();
      expect(hit!.timestamp).toBeGreaterThan(entry.timestamp);
    });

    it('evicts least-recently-used entries, not most popular', async () => {
      const base = Date.now() - 10_000;
      for (let i = 0; i < 5; i++) {
        await storage.cacheAnswer(`q${i}`, makeEntry(`q${i}`, base + i));
      }

      // Touch the oldest entry so it becomes most recent
      await storage.getCachedAnswer('q0', 24 * 60 * 60 * 1000);

      await storage.limitCacheSize(3);

      expect(await storage.getCachedAnswer('q0', 24 * 60 * 60 * 1000)).toBeDefined();
      expect(await storage.getCachedAnswer('q1', 24 * 60 * 60 * 1000)).toBeUndefined();
    });

    it('clearCache removes all cached answers but keeps chunks', async () => {
      await storage.saveChunks([{ id: 'c', doc_id: 'd', source: 's', content: 'keep me' }]);
      await storage.cacheAnswer('q', makeEntry('q'));

      await storage.clearCache();

      const stats = await storage.getStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.chunkCount).toBe(1);
    });
  });

  it('clearAll wipes chunks, manifests, and cache', async () => {
    await storage.saveChunks([{ id: 'c', doc_id: 'd', source: 's', content: 'x' }]);
    await storage.saveManifest({ doc_id: 'd', checksum: 'abc', version: '2.1', updated: Date.now(), chunkCount: 1 });
    await storage.cacheAnswer('q', makeEntry('q'));

    await storage.clearAll();

    const stats = await storage.getStats();
    expect(stats.chunkCount).toBe(0);
    expect(stats.documentCount).toBe(0);
    expect(stats.cacheSize).toBe(0);
  });
});
