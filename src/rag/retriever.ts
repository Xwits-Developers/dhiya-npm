/**
 * Semantic retrieval with optional hybrid keyword boosting and diversity
 * filtering.
 *
 * Hybrid design:
 * - `threshold` is a pure-cosine relevance floor. Keyword evidence never
 *   admits a chunk the vector model scores as actively dissimilar, and never
 *   demotes a chunk below its cosine score.
 * - BM25 keyword scores pass through a saturating transform
 *   (raw / (raw + K)) so a weak best-match is NOT stretched to 1.0 — only
 *   genuinely strong lexical evidence contributes.
 * - The blended score is cosine plus a keyword BOOST toward 1:
 *   score = cosine + keywordWeight * kw * (1 - max(0, cosine)).
 *   With no keyword match the score equals the cosine exactly, so hybrid can
 *   only improve on pure vector ranking.
 * - A chunk below the cosine floor is still admitted when its lexical
 *   evidence is strong (kw >= 0.5, i.e. raw BM25 >= K) and its cosine is
 *   non-negative — this is the exact-code/name case hybrid search exists for.
 */

import { SearchResult, Chunk, RetrievalOptions } from '../core/types.js';
import { cosineSimilarity } from '../utils/similarity.js';
import { KeywordIndex } from './keyword-index.js';

/**
 * Saturation constant: kw = raw / (raw + K_SAT). raw=K_SAT → kw=0.5.
 * Calibrated so a single distinctive-term match in a small corpus
 * (raw BM25 ≈ 1.0) clears the strong-lexical admission bar (kw ≥ 0.5),
 * while incidental shared-word matches (raw ≪ 0.75) stay far below it.
 */
const K_SAT = 0.75;

export class Retriever {
  private chunks: Chunk[] = [];
  private keywordIndex = new KeywordIndex();
  private indexSignature = '';

  /**
   * Set the chunks to search through. Rebuilds the keyword index unless the
   * chunk set is identical to the current one (rebuild is O(corpus tokens)).
   */
  setChunks(chunks: Chunk[]): void {
    this.chunks = chunks;
    const signature = chunks.length + '|' + chunks.map(c => c.id).join(',');
    if (signature !== this.indexSignature) {
      this.keywordIndex.build(chunks);
      this.indexSignature = signature;
    }
  }

  /**
   * Retrieve relevant chunks for a query.
   */
  async retrieve(
    queryEmbedding: ArrayLike<number>,
    options: RetrievalOptions,
    queryText?: string
  ): Promise<SearchResult[]> {
    const {
      topK = 5,
      threshold = 0.2,
      useDiversity = true,
      diversityThreshold = 0.95,
      hybrid = true,
      keywordWeight = 0.4
    } = options;

    if (this.chunks.length === 0) {
      return [];
    }

    const useKeyword = hybrid && !!queryText && keywordWeight > 0 && this.keywordIndex.size() > 0;
    const rawKeywordScores = useKeyword ? this.keywordIndex.scoreAll(queryText!) : null;

    const results: SearchResult[] = [];
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (!chunk.embedding || chunk.embedding.length === 0) continue;

      const cosine = cosineSimilarity(queryEmbedding, chunk.embedding);

      // Saturating keyword score in [0, 1); weak matches stay small.
      const raw = rawKeywordScores ? rawKeywordScores[i] : 0;
      const kw = raw > 0 ? raw / (raw + K_SAT) : 0;

      const passesVectorFloor = cosine >= threshold;
      const strongLexicalMatch = useKeyword && kw >= 0.5 && cosine >= 0;
      if (!passesVectorFloor && !strongLexicalMatch) continue;

      const score = useKeyword
        ? Math.min(1, cosine + keywordWeight * kw * (1 - Math.max(0, cosine)))
        : cosine;

      results.push({ chunk, similarity: score });
    }

    results.sort((a, b) => b.similarity - a.similarity);

    if (!useDiversity) {
      return results.slice(0, topK);
    }

    return this.applyDiversityFilter(results, topK, diversityThreshold);
  }

  /**
   * Apply diversity filtering to avoid near-duplicate results
   */
  private applyDiversityFilter(
    results: SearchResult[],
    topK: number,
    diversityThreshold: number
  ): SearchResult[] {
    const diverse: SearchResult[] = [];

    for (const result of results) {
      if (diverse.length >= topK) break;

      const isTooSimilar = diverse.some(selected => {
        if (!result.chunk.embedding || !selected.chunk.embedding) return false;
        const similarity = cosineSimilarity(
          result.chunk.embedding,
          selected.chunk.embedding
        );
        return similarity >= diversityThreshold;
      });

      if (!isTooSimilar) {
        diverse.push(result);
      }
    }

    return diverse;
  }

  getChunksByIds(ids: string[]): Chunk[] {
    const idSet = new Set(ids);
    return this.chunks.filter(chunk => idSet.has(chunk.id));
  }

  getAllChunks(): Chunk[] {
    return this.chunks;
  }

  getChunkCount(): number {
    return this.chunks.length;
  }
}
