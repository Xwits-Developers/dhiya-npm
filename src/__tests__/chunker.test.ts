/**
 * Unit tests for text chunking
 */

import { describe, it, expect } from 'vitest';
import { chunkText, createChunks } from '../rag/chunker';

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
      expect(chunk.content.length).toBeLessThanOrEqual(200);
    });
  });

  it('should create overlapping chunks', () => {
    const text = 'The quick brown fox jumps. Lazy dogs sleep all day. Cats prowl at night. Birds sing at dawn. Fish swim in rivers. '.repeat(3);
    const chunks = chunkText(text, { chunkSize: 120, overlap: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    // Consecutive chunks should share some text (the overlap tail)
    const tailWord = chunks[0].content.trim().split(/\s+/).pop()!;
    expect(chunks[1].content).toContain(tailWord.replace(/[.!?]$/, ''));
  });

  it('should handle small texts', () => {
    const text = 'Short text';
    const chunks = chunkText(text);

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(text);
  });

  it('should handle empty text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('should split on paragraph boundaries when possible', () => {
    const para1 = 'First topic sentence one. First topic sentence two.';
    const para2 = 'Second topic sentence one. Second topic sentence two.';
    const chunks = chunkText(`${para1}\n\n${para2}`, { chunkSize: 60, overlap: 0 });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].content).toContain('First topic');
    expect(chunks[0].content).not.toContain('Second topic');
  });

  it('should include metadata', () => {
    const metadata = { source: 'test.txt', title: 'Test' };
    const chunks = chunkText('Test text', { metadata });

    expect(chunks[0].metadata).toMatchObject(metadata);
  });

  it('regression: terminates when overlap is close to chunk size', () => {
    const text = 'word '.repeat(2000);
    const chunks = chunkText(text, { chunkSize: 300, chunkOverlap: 290 });

    // Used to infinite-loop and emit tens of thousands of duplicates
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(100);
  });

  it('regression: never drops content between chunks', () => {
    const sentences = Array.from({ length: 60 }, (_, i) => `Unique sentence number ${i} carries marker m${i}.`);
    const text = sentences.join(' ');
    const chunks = chunkText(text, { chunkSize: 200, overlap: 50 });

    const combined = chunks.map(c => c.content).join(' ');
    for (let i = 0; i < 60; i++) {
      expect(combined).toContain(`m${i}`);
    }
  });

  it('should handle text with no sentence boundaries', () => {
    const text = 'x'.repeat(2500);
    const chunks = chunkText(text, { chunkSize: 500, overlap: 50 });

    expect(chunks.length).toBeGreaterThanOrEqual(5);
    const combined = chunks.map(c => c.content).join('');
    expect(combined.length).toBeGreaterThanOrEqual(2500);
  });

  it('createChunks assigns stable doc-scoped ids', () => {
    const chunks = createChunks('One two three. '.repeat(100), 'doc-1', 'doc-1', { chunkSize: 200 });
    expect(chunks[0].id).toBe('doc-1-chunk-0');
    expect(chunks[0].doc_id).toBe('doc-1');
    expect(chunks.every((c, i) => c.id === `doc-1-chunk-${i}`)).toBe(true);
  });
});
