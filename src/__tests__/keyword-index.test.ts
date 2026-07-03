import { describe, it, expect } from 'vitest';
import { KeywordIndex, tokenize } from '../rag/keyword-index';
import { Chunk } from '../core/types';

function chunk(id: string, content: string): Chunk {
  return { id, doc_id: 'd', source: 's', content };
}

describe('tokenize', () => {
  it('lowercases, drops stopwords, keeps unicode', () => {
    expect(tokenize('What is the Warranty?')).toEqual(['warranty']);
    expect(tokenize('Model XR-500 café')).toEqual(['model', 'xr', '500', 'café']);
  });

  it('regression: keeps single-character identifiers', () => {
    // "C" the language, vitamin "B" — exact terms are the index's purpose
    expect(tokenize('What is C?')).toEqual(['c']);
    expect(tokenize('vitamin B dosage')).toEqual(['vitamin', 'b', 'dosage']);
  });
});

describe('KeywordIndex (BM25)', () => {
  const chunks = [
    chunk('c0', 'The warranty covers manufacturing defects for two years.'),
    chunk('c1', 'Refunds can be requested within 30 days of purchase.'),
    chunk('c2', 'The activation code for the XR-500 router is printed on the box.')
  ];

  it('ranks the chunk containing an exact rare term first', () => {
    const idx = new KeywordIndex();
    idx.build(chunks);

    const scores = idx.scoreAll('XR-500 activation code');
    const best = scores.indexOf(Math.max(...scores));
    expect(best).toBe(2);
    expect(scores[2]).toBeGreaterThan(0);
  });

  it('returns all-zero scores when no query term matches', () => {
    const idx = new KeywordIndex();
    idx.build(chunks);
    const scores = idx.scoreAll('elephant giraffe');
    expect(scores.every(s => s === 0)).toBe(true);
  });

  it('handles an empty index', () => {
    const idx = new KeywordIndex();
    idx.build([]);
    expect(idx.scoreAll('anything')).toEqual([]);
    expect(idx.size()).toBe(0);
  });
});
