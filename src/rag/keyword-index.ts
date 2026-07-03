/**
 * Lightweight BM25 keyword index.
 *
 * Complements vector search: embeddings capture meaning but miss exact terms
 * (product codes, names, acronyms, error strings). BM25 over the same chunks
 * recovers those. Built in memory whenever the retriever's chunk set changes.
 */

import { Chunk } from '../core/types.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'has', 'have', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'to', 'was', 'were', 'will', 'with', 'this', 'they', 'you', 'your',
  'i', 'we', 'do', 'does', 'how', 'what', 'when', 'where', 'who', 'why'
]);

const K1 = 1.5;
const B = 0.75;

/**
 * Unicode-aware tokenizer: letters/digits in any script, stop words removed.
 * Single-character tokens are kept — exact-term matching is the whole point
 * of the keyword index, and identifiers like the language "C" or vitamin "B"
 * are single characters (noisy ones like "a"/"i" are in STOP_WORDS).
 */
export function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length > 0 && !STOP_WORDS.has(t));
  return tokens;
}

export class KeywordIndex {
  private docTokens: string[][] = [];
  private termFreq: Array<Map<string, number>> = [];
  private docFreq: Map<string, number> = new Map();
  private avgDocLen = 0;
  private docCount = 0;

  build(chunks: Chunk[]): void {
    this.docTokens = [];
    this.termFreq = [];
    this.docFreq = new Map();
    this.docCount = chunks.length;

    let totalLen = 0;
    for (const chunk of chunks) {
      const tokens = tokenize(chunk.content);
      this.docTokens.push(tokens);
      totalLen += tokens.length;

      const tf = new Map<string, number>();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }
      this.termFreq.push(tf);

      for (const term of tf.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
      }
    }

    this.avgDocLen = this.docCount > 0 ? totalLen / this.docCount : 0;
  }

  /**
   * BM25 score for a query against every document, aligned to chunk index.
   * Returns an array of raw scores (>= 0); callers normalize as needed.
   */
  scoreAll(query: string): number[] {
    const queryTerms = Array.from(new Set(tokenize(query)));
    const scores = new Array(this.docCount).fill(0);

    if (this.docCount === 0 || queryTerms.length === 0) {
      return scores;
    }

    for (const term of queryTerms) {
      const df = this.docFreq.get(term);
      if (!df) continue;

      // BM25 idf with the standard +1 to keep it non-negative
      const idf = Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));

      for (let i = 0; i < this.docCount; i++) {
        const tf = this.termFreq[i].get(term);
        if (!tf) continue;

        const docLen = this.docTokens[i].length;
        const denom = tf + K1 * (1 - B + (B * docLen) / (this.avgDocLen || 1));
        scores[i] += idf * ((tf * (K1 + 1)) / denom);
      }
    }

    return scores;
  }

  size(): number {
    return this.docCount;
  }
}
