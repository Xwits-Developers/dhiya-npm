/**
 * Semantic retrieval with diversity filtering
 */

import { SearchResult, Chunk, RetrievalOptions } from '../core/types';
import { cosineSimilarity } from '../utils/similarity';

export class Retriever {
  private chunks: Chunk[] = [];
  
  /**
   * Set the chunks to search through
   */
  setChunks(chunks: Chunk[]): void {
    this.chunks = chunks;
  }
  
  /**
   * Retrieve relevant chunks for a query
   */
  async retrieve(
    queryEmbedding: number[],
    options: RetrievalOptions
  ): Promise<SearchResult[]> {
    const {
      topK = 5,
      threshold = 0.25,
      useDiversity = true,
      diversityThreshold = 0.95
    } = options;
    
    if (this.chunks.length === 0) {
      return [];
    }
    
    // Score all chunks
    const results: SearchResult[] = this.chunks
      .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
      .map(chunk => ({
        chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding!)
      }))
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);
    
    if (!useDiversity) {
      return results.slice(0, topK);
    }
    
    // Apply diversity filtering
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
      
      // Check if too similar to already selected results
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
  
  /**
   * Get chunks by IDs
   */
  getChunksByIds(ids: string[]): Chunk[] {
    const idSet = new Set(ids);
    return this.chunks.filter(chunk => idSet.has(chunk.id));
  }
  
  /**
   * Get all chunks
   */
  getAllChunks(): Chunk[] {
    return this.chunks;
  }
  
  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunks.length;
  }
}
