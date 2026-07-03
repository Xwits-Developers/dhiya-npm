/**
 * Answer synthesis from retrieved chunks
 */

import { SearchResult, Source } from '../core/types.js';
import { extractUrls } from '../utils/normalize.js';

export interface SynthesizeOptions {
  maxSources?: number;
  includeUrls?: boolean;
  confidenceThreshold?: number;
  noAnswerMessage?: string;
}

/**
 * Synthesize answer from search results
 */
export function synthesizeAnswer(
  query: string,
  results: SearchResult[],
  options: SynthesizeOptions = {}
): { text: string; sources: Source[]; confidence: number } {
  const {
    maxSources = 3,
    confidenceThreshold = 0.8,
    noAnswerMessage = "I don't have enough information to answer that question."
  } = options;

  if (results.length === 0) {
    return {
      text: noAnswerMessage,
      sources: [],
      confidence: 0
    };
  }

  // Confidence: mean of top-3 similarities to reduce volatility
  const topSimilarity = results[0].similarity;
  const simSamples = results.slice(0, 3).map(r => r.similarity);
  const confidence = simSamples.reduce((a, b) => a + b, 0) / simSamples.length;

  // Single high-confidence short chunk reads like a direct answer
  if (topSimilarity >= confidenceThreshold) {
    const direct = results[0].chunk.content.trim();
    if (direct.length <= 220) {
      return {
        text: direct,
        sources: createSources(results.slice(0, 1)),
        confidence
      };
    }
  }

  const topResults = results.slice(0, maxSources);
  const text = synthesizeFromMultiple(topResults, query);
  const sources = createSources(topResults);

  return {
    text,
    sources,
    confidence
  };
}

/**
 * Synthesize text from multiple chunks
 */
function synthesizeFromMultiple(results: SearchResult[], query: string): string {
  if (results.length === 0) return '';
  if (results.length === 1) return trimChunk(results[0].chunk.content, query);

  const keywords = queryKeywords(query);
  const snippets: string[] = [];
  for (let i = 0; i < Math.min(3, results.length); i++) {
    const c = results[i].chunk.content;
    const snippet = extractFocusedSnippet(c, keywords, 240);
    if (snippet) snippets.push(snippet);
  }
  const merged = Array.from(new Set(snippets)).join('\n\n');
  return merged.length > 700 ? merged.slice(0, 700).trimEnd() + '…' : merged;
}

const QUERY_STOP_WORDS = new Set([
  'what', 'is', 'are', 'the', 'a', 'an', 'of', 'in', 'for', 'to', 'and',
  'define', 'explain', 'who', 'how', 'does', 'do', 'can', 'about', 'me',
  'tell', 'please', 'your', 'my', 'it', 'this', 'that'
]);

/**
 * Extract meaningful keywords from a query. Hyphenated words contribute
 * their parts too ("privacy-first" matches "privacy").
 */
export function queryKeywords(query: string): string[] {
  const cleaned = query.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '');
  const tokens = cleaned
    .split(/[\s-]+/)
    .filter(t => t.length > 1)
    .filter(t => !QUERY_STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
}

/**
 * Pick the sentence in `text` that matches the most query keywords.
 * Falls back to the first sentence when nothing matches.
 */
export function extractFocusedSnippet(text: string, keywords: string[] | string, maxLen: number): string {
  const kws = (Array.isArray(keywords) ? keywords : [keywords]).filter(Boolean);
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let chosen: string | undefined;
  let bestScore = 0;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const score = kws.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      chosen = sentence;
    }
  }

  if (!chosen) chosen = sentences[0] || text.slice(0, maxLen);
  if (chosen.length > maxLen) chosen = chosen.slice(0, maxLen).trimEnd() + '…';
  return chosen;
}

function trimChunk(text: string, query: string): string {
  return extractFocusedSnippet(text, queryKeywords(query), 300);
}

/**
 * Create source objects from search results
 */
function createSources(results: SearchResult[]): Source[] {
  return results.map(result => ({
    id: result.chunk.id,
    title: result.chunk.metadata?.title,
    content: result.chunk.content.slice(0, 200), // Preview
    url: result.chunk.metadata?.url,
    similarity: result.similarity
  }));
}

/**
 * Extract all URLs from results
 */
export function extractAllUrls(results: SearchResult[]): string[] {
  const urls = new Set<string>();

  for (const result of results) {
    const chunkUrls = extractUrls(result.chunk.content);
    chunkUrls.forEach(url => urls.add(url));

    if (result.chunk.metadata?.url) {
      urls.add(result.chunk.metadata.url);
    }
  }

  return Array.from(urls);
}

/**
 * Format answer with related links
 */
export function formatAnswer(
  text: string,
  _sources: Source[],
  urls: string[] = []
): string {
  let formatted = text;

  if (urls.length > 0) {
    formatted += '\n\n**Related links:**\n';
    formatted += urls.slice(0, 5).map(url => `- ${url}`).join('\n');
  }

  return formatted;
}

/**
 * Build the grounded prompt used for LLM answer generation.
 */
export function createLLMPrompt(
  query: string,
  context: string,
  conversationHistory?: Array<{ query: string; answer: string }>
): string {
  let prompt = '';

  if (conversationHistory && conversationHistory.length > 0) {
    prompt += 'Previous conversation:\n';
    conversationHistory.slice(-3).forEach(turn => {
      prompt += `Q: ${turn.query}\nA: ${turn.answer}\n\n`;
    });
  }

  prompt += `Context:\n${context}\n\n`;
  prompt += `Question: ${query}\n\n`;
  prompt +=
    'Answer the question using only the context above. ' +
    'If the context does not contain the answer, say you do not have that information.';

  return prompt;
}
