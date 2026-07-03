/**
 * Text chunking utilities.
 *
 * Strategy: split the cleaned text into paragraphs, split oversized
 * paragraphs into sentences (and oversized sentences by words), then pack
 * the resulting units greedily into chunks up to chunkSize with a
 * sentence-aligned overlap carried between consecutive chunks. Content is
 * never dropped and the algorithm consumes one unit per step, so it always
 * terminates regardless of configuration.
 */

import { Chunk } from '../core/types.js';
import { cleanText } from '../utils/normalize.js';

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
  chunkOverlap?: number;
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

  const cleanedText = cleanText(text);

  if (!cleanedText) {
    return [];
  }

  if (cleanedText.length <= chunkSize) {
    return [makeChunk(cleanedText, 0, options.metadata)];
  }

  const units = splitIntoUnits(cleanedText, chunkSize);

  const contents: string[] = [];
  let current = '';

  for (const unit of units) {
    const candidate = current ? `${current}${unit.joiner}${unit.text}` : unit.text;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      contents.push(current);
      // Carry a sentence-aligned tail of the previous chunk as overlap
      const tail = chunkOverlap > 0 ? overlapTail(current, chunkOverlap) : '';
      current = tail ? `${tail} ${unit.text}` : unit.text;
      // If the unit alone (plus overlap) still exceeds chunkSize, flush the
      // overlap and keep only the unit; units are pre-split to fit chunkSize.
      if (current.length > chunkSize) {
        current = unit.text;
      }
    } else {
      current = unit.text;
    }
  }

  if (current.trim()) {
    contents.push(current.trim());
  }

  return contents.map((content, index) => makeChunk(content, index, options.metadata, contents.length));
}

interface TextUnit {
  text: string;
  /** Separator to use when appending to the current chunk. */
  joiner: string;
}

/**
 * Break text into paragraph/sentence/word units no longer than chunkSize.
 */
function splitIntoUnits(text: string, chunkSize: number): TextUnit[] {
  const units: TextUnit[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (trimmed.length <= chunkSize) {
      units.push({ text: trimmed, joiner: '\n\n' });
      continue;
    }

    // Paragraph too large: split into sentences
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (!sentence) continue;

      if (sentence.length <= chunkSize) {
        units.push({ text: sentence, joiner: ' ' });
        continue;
      }

      // Sentence too large: hard-split on words
      let remaining = sentence;
      while (remaining.length > chunkSize) {
        let cut = remaining.lastIndexOf(' ', chunkSize);
        if (cut < chunkSize / 2) cut = chunkSize; // no usable space; hard cut
        units.push({ text: remaining.slice(0, cut).trim(), joiner: ' ' });
        remaining = remaining.slice(cut).trim();
      }
      if (remaining) {
        units.push({ text: remaining, joiner: ' ' });
      }
    }
  }

  return units;
}

/**
 * Take up to `overlap` characters from the end of a chunk, aligned to a
 * sentence start when possible, otherwise to a word boundary.
 */
function overlapTail(text: string, overlap: number): string {
  const window = text.slice(-overlap);

  // Prefer starting at a sentence boundary inside the window
  const sentenceStart = window.search(/(?<=[.!?])\s+/);
  if (sentenceStart !== -1) {
    const tail = window.slice(sentenceStart).trim();
    if (tail) return tail;
  }

  // Fall back to a word boundary
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
