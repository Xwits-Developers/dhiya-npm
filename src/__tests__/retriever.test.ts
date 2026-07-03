import { describe, it, expect } from 'vitest';
import { Retriever } from '../rag/retriever';
import { Chunk } from '../core/types';

// Deterministic bag-of-words embedding (same scheme as integration tests) so
// cosine similarity is meaningful and we can isolate the keyword contribution.
function embed(text: string): Float32Array {
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

function chunk(id: string, content: string): Chunk {
  return { id, doc_id: 'd', source: 's', content, embedding: embed(content) };
}

describe('Retriever hybrid search', () => {
  const chunks = [
    chunk('c0', 'Our return policy allows sending items back for store credit.'),
    chunk('c1', 'To reset your device, hold the power button for ten seconds.'),
    chunk('c2', 'The activation code XR500 unlocks the premium plan for one year.')
  ];

  it('surfaces an exact-term match via the keyword component', async () => {
    const r = new Retriever();
    r.setChunks(chunks);

    // A query whose embedding overlap is weak but shares the exact code token.
    const q = 'XR500';
    const results = await r.retrieve(embed(q), { topK: 3, threshold: 0, keywordWeight: 0.5 }, q);
    expect(results[0].chunk.id).toBe('c2');
  });

  it('pure-vector mode ignores keyword text', async () => {
    const r = new Retriever();
    r.setChunks(chunks);

    const q = 'reset the device power button';
    const results = await r.retrieve(embed(q), { topK: 3, threshold: 0, hybrid: false }, q);
    expect(results[0].chunk.id).toBe('c1');
  });

  it('returns empty for an empty index', async () => {
    const r = new Retriever();
    r.setChunks([]);
    expect(await r.retrieve(embed('x'), { topK: 3 }, 'x')).toEqual([]);
  });

  it('regression: chunks without keyword hits keep their pure cosine score (no demotion)', async () => {
    const r = new Retriever();
    r.setChunks(chunks);

    // Query shares vocabulary with c1 but its tokens keyword-match nothing
    // strongly relevant elsewhere; hybrid must not depress cosine scores.
    const q = 'hold the power button';
    const hybrid = await r.retrieve(embed(q), { topK: 3, threshold: 0, keywordWeight: 0.9 }, q);
    const pure = await r.retrieve(embed(q), { topK: 3, threshold: 0, hybrid: false }, q);

    expect(hybrid[0].chunk.id).toBe(pure[0].chunk.id);
    // Blended score is a boost: never below the pure cosine of the same chunk
    expect(hybrid[0].similarity).toBeGreaterThanOrEqual(pure[0].similarity - 1e-9);
  });

  it('regression: strong lexical match is admitted even below the cosine floor', async () => {
    const r = new Retriever();
    r.setChunks(chunks);

    // Threshold so high no chunk passes on cosine alone; the chunk holding
    // the exact rare code must still be admitted via lexical evidence.
    const results = await r.retrieve(embed('XR500'), { topK: 3, threshold: 0.95 }, 'XR500');
    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe('c2');
  });

  it('regression: weak keyword overlap cannot admit a chunk below the cosine floor', async () => {
    const r = new Retriever();
    r.setChunks(chunks);

    // 'items' appears once in c0 but is a weak, non-distinctive match;
    // with an impossible cosine floor nothing should be admitted.
    const results = await r.retrieve(embed('zzz qqq items'), { topK: 3, threshold: 0.95 }, 'zzz qqq items');
    expect(results.every(res => res.chunk.id !== 'c1')).toBe(true);
  });

  it('rebuilds the keyword index when chunks change', async () => {
    const r = new Retriever();
    r.setChunks(chunks);
    r.setChunks([chunk('n0', 'Completely new content about invoicing and taxes.')]);

    const results = await r.retrieve(embed('invoicing taxes'), { topK: 3, threshold: 0 }, 'invoicing taxes');
    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe('n0');
  });
});
