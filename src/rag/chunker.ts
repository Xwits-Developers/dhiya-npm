/**
 * Text chunking utilities.
 *
 * Strategy: paragraphs are the retrieval unit. Each paragraph becomes its
 * own chunk — semantically coherent chunks retrieve far better than packed
 * multi-topic blocks. Very short paragraphs (headings, list fragments) are
 * merged forward into the next paragraph, and paragraphs longer than
 * chunkSize are split on sentence boundaries with a sentence-aligned
 * overlap. Content is never dropped and every step consumes input, so
 * chunking terminates for any configuration.
 */

import { Chunk } from '../core/types.js';
import { cleanText } from '../utils/normalize.js';

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
  chunkOverlap?: number;
  /** Paragraphs shorter than this merge into the following paragraph. */
  minChunkSize?: number;
  maxChunkSize?: number;
  metadata?: Record<string, any>;
}

/**
 * Split text into chunks with smart boundaries
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): Chunk[] {
  const chunkSize = Math.max(50, options.chunkSize || 900);
  const requestedOverlap = options.overlap ?? options.chunkOverlap ?? 120;
  // Overlap above half the chunk size cannot make progress; clamp it.
  const chunkOverlap = Math.max(0, Math.min(requestedOverlap, Math.floor(chunkSize / 2)));
  // Threshold for forward-merging heading-like fragments; a full sentence
  // is a legitimate standalone chunk.
  const minUnitSize = Math.min(options.minChunkSize ?? 40, chunkSize);

  const cleanedText = cleanText(text);

  if (!cleanedText) {
    return [];
  }

  // 1. Paragraph units, with short paragraphs merged forward
  const paragraphs = cleanedText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const units: string[] = [];
  let buffer = '';

  for (const paragraph of paragraphs) {
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (buffer.length >= minUnitSize) {
      units.push(buffer);
      buffer = '';
    }
  }
  if (buffer) {
    // Trailing short paragraph: attach to the previous unit when possible
    if (units.length > 0 && units[units.length - 1].length + buffer.length + 2 <= chunkSize) {
      units[units.length - 1] += `\n\n${buffer}`;
    } else {
      units.push(buffer);
    }
  }

  // 2. Split any unit that exceeds chunkSize on sentence boundaries
  const contents: string[] = [];
  for (const unit of units) {
    if (unit.length <= chunkSize) {
      contents.push(unit);
    } else {
      contents.push(...packSentences(unit, chunkSize, chunkOverlap));
    }
  }

  return contents.map((content, index) =>
    makeChunk(content, index, options.metadata, contents.length)
  );
}

/**
 * Pack the sentences of one oversized paragraph into chunks up to chunkSize,
 * carrying a sentence-aligned overlap between consecutive chunks.
 */
function packSentences(paragraph: string, chunkSize: number, chunkOverlap: number): string[] {
  const sentences: string[] = [];

  for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
    if (!sentence) continue;
    if (sentence.length <= chunkSize) {
      sentences.push(sentence);
      continue;
    }

    // Sentence longer than a whole chunk: hard-split on words
    let remaining = sentence;
    while (remaining.length > chunkSize) {
      let cut = remaining.lastIndexOf(' ', chunkSize);
      if (cut < chunkSize / 2) cut = chunkSize; // no usable space; hard cut
      sentences.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) {
      sentences.push(remaining);
    }
  }

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      const tail = chunkOverlap > 0 ? overlapTail(current, chunkOverlap) : '';
      current = tail ? `${tail} ${sentence}` : sentence;
      if (current.length > chunkSize) {
        current = sentence; // overlap did not fit alongside the sentence
      }
    } else {
      current = sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Take up to `overlap` characters from the end of a chunk, aligned to a
 * sentence start when possible, otherwise to a word boundary.
 */
function overlapTail(text: string, overlap: number): string {
  const window = text.slice(-overlap);

  const sentenceStart = window.search(/(?<=[.!?])\s+/);
  if (sentenceStart !== -1) {
    const tail = window.slice(sentenceStart).trim();
    if (tail) return tail;
  }

  const wordStart = window.indexOf(' ');
  if (wordStart !== -1 && wordStart < window.length - 1) {
    return window.slice(wordStart + 1).trim();
  }

  return '';
}

function makeChunk(
  content: string,
  index: number,
  metadata?: Record<string, any>,
  totalChunks?: number
): Chunk {
  return {
    id: index.toString(),
    doc_id: 'default',
    source: 'text',
    content,
    metadata: {
      ...metadata,
      chunkIndex: index,
      ...(totalChunks !== undefined ? { totalChunks } : {})
    }
  };
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
      merged += '\n\n' + current;
    }
  }

  return merged;
}
