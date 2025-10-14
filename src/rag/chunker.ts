/**
 * Text chunking utilities
 */

import { Chunk } from '../core/types';
import { cleanText } from '../utils/normalize';
import { CHUNKING_CONFIG } from '../core/config';

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
  metadata?: Record<string, any>;
}

/**
 * Split text into overlapping chunks with smart boundaries
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): Chunk[] {
  // Merge options with defaults
  const chunkSize = options.chunkSize || 900;
  const chunkOverlap = options.overlap || options.chunkOverlap || 120;
  const minChunkSize = options.minChunkSize || CHUNKING_CONFIG.minChunkSize;
  
  const cleanedText = cleanText(text);
  
  if (cleanedText.length <= chunkSize) {
    return [{
      id: '0',
      doc_id: 'default',
      source: 'text',
      content: cleanedText,
      metadata: options.metadata || {}
    }];
  }
  
  const textChunks: string[] = [];
  let start = 0;
  
  while (start < cleanedText.length) {
    let end = start + chunkSize;
    
    // Last chunk - take everything remaining
    if (end >= cleanedText.length) {
      textChunks.push(cleanedText.slice(start).trim());
      break;
    }
    
    // Try to find a good boundary (prefer sentence > paragraph > word)
    end = findBestBoundary(cleanedText, start, end);
    
    // Extract chunk
    const chunk = cleanedText.slice(start, end).trim();
    
    if (chunk.length >= minChunkSize) {
      textChunks.push(chunk);
    }
    
    // Move start position with overlap
    start = end - chunkOverlap;
    
    // Ensure we make progress
    const lastChunkStart = textChunks.length > 0 ? textChunks[textChunks.length - 1].length : 0;
    if (start <= lastChunkStart) {
      start = end;
    }
  }
  
  // Convert text chunks to Chunk objects
  return textChunks.map((content, index) => ({
    id: index.toString(),
    doc_id: 'default',
    source: 'text',
    content,
    metadata: {
      ...options.metadata,
      chunkIndex: index,
      totalChunks: textChunks.length
    }
  }));
}

/**
 * Find the best boundary for splitting text
 */
function findBestBoundary(text: string, start: number, idealEnd: number): number {
  // Search window around ideal end point
  const searchStart = Math.max(start, idealEnd - 100);
  const searchEnd = Math.min(text.length, idealEnd + 100);
  const searchText = text.slice(searchStart, searchEnd);
  
  // 1. Try paragraph boundary first
  for (const boundary of CHUNKING_CONFIG.paragraphBoundaries) {
    const index = searchText.lastIndexOf(boundary);
    if (index !== -1 && index > searchText.length / 3) {
      return searchStart + index + boundary.length;
    }
  }
  
  // 2. Try sentence boundary
  for (const boundary of CHUNKING_CONFIG.sentenceBoundaries) {
    const index = searchText.lastIndexOf(boundary);
    if (index !== -1 && index > searchText.length / 3) {
      return searchStart + index + boundary.length;
    }
  }
  
  // 3. Try word boundary
  const spaceIndex = searchText.lastIndexOf(' ');
  if (spaceIndex !== -1 && spaceIndex > searchText.length / 3) {
    return searchStart + spaceIndex + 1;
  }
  
  // 4. Fall back to ideal end
  return idealEnd;
}

/**
 * Create chunk objects from text
 */
export function createChunks(
  text: string,
  docId: string,
  source: string,
  options: ChunkOptions,
  metadata?: Record<string, any>
): Chunk[] {
  const chunks = chunkText(text, options);
  
  // Update chunk IDs and metadata
  return chunks.map((chunk, index) => ({
    ...chunk,
    id: `${docId}-chunk-${index}`,
    doc_id: docId,
    source: `${source}#chunk-${index}`,
    metadata: {
      ...chunk.metadata,
      ...metadata,
      chunkIndex: index,
      totalChunks: chunks.length
    }
  }));
}

/**
 * Merge overlapping chunks (for reconstruction)
 */
export function mergeChunks(chunks: Chunk[], overlap: number): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0].content;
  
  let merged = chunks[0].content;
  
  for (let i = 1; i < chunks.length; i++) {
    const current = chunks[i].content;
    
    // Find overlap
    let overlapLength = Math.min(overlap, merged.length, current.length);
    let found = false;
    
    while (overlapLength > 20 && !found) {
      const mergedEnd = merged.slice(-overlapLength);
      const currentStart = current.slice(0, overlapLength);
      
      if (mergedEnd === currentStart) {
        merged += current.slice(overlapLength);
        found = true;
      } else {
        overlapLength -= 10;
      }
    }
    
    if (!found) {
      // No overlap found, just append
      merged += '\n\n' + current;
    }
  }
  
  return merged;
}
