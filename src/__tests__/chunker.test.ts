/**
 * Unit tests for text chunking
 */

import { describe, it, expect } from 'vitest';
import { chunkText } from '../rag/chunker';

describe('Chunker', () => {
  it('should split text into chunks', () => {
    const text = 'This is a test. '.repeat(100);
    const chunks = chunkText(text);
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toHaveProperty('id');
    expect(chunks[0]).toHaveProperty('content');
    expect(chunks[0]).toHaveProperty('metadata');
  });
  
  it('should respect chunk size limits', () => {
    const text = 'Word '.repeat(500);
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });
    
    chunks.forEach(chunk => {
      expect(chunk.content.length).toBeLessThanOrEqual(200); // Some tolerance for boundary finding
    });
  });
  
  it('should create overlapping chunks', () => {
    const text = 'Sentence one. Sentence two. Sentence three. Sentence four.';
    const chunks = chunkText(text, { chunkSize: 30, overlap: 10 });
    
    // Short text may fit in one chunk
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // Check for overlap if multiple chunks
    if (chunks.length > 1) {
      const lastWords = chunks[0].content.slice(-10);
      expect(chunks[1].content).toContain(lastWords.trim().split(' ').pop());
    }
  });
  
  it('should handle small texts', () => {
    const text = 'Short text';
    const chunks = chunkText(text);
    
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(text);
  });
  
  it('should preserve sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = chunkText(text, { chunkSize: 25, overlap: 5 });
    
    chunks.forEach(chunk => {
      const trimmed = chunk.content.trim();
      // Most chunks should end with sentence boundaries
      const endsWithPunctuation = /[.!?]$/.test(trimmed);
      expect(endsWithPunctuation || chunk === chunks[chunks.length - 1]).toBe(true);
    });
  });
  
  it('should include metadata', () => {
    const metadata = { source: 'test.txt', title: 'Test' };
    const chunks = chunkText('Test text', { metadata });
    
    expect(chunks[0].metadata).toEqual(metadata);
  });
});
