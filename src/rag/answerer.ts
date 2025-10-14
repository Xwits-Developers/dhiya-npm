/**
 * Answer synthesis from retrieved chunks
 */

import { SearchResult, Source } from '../core/types';
import { extractUrls } from '../utils/normalize';

export interface SynthesizeOptions {
  maxSources?: number;
  includeUrls?: boolean;
  confidenceThreshold?: number;
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
    includeUrls = true,
    confidenceThreshold = 0.8
  } = options;
  
  if (results.length === 0) {
    return {
      text: "I don't have enough information to answer that question.",
      sources: [],
      confidence: 0
    };
  }
  
  // Calculate overall confidence
  const topSimilarity = results[0].similarity;
  // Confidence: weighted mean of top 3 similarities (if available) to reduce volatility
  const simSamples = results.slice(0, 3).map(r => r.similarity);
  const confidence = simSamples.reduce((a, b) => a + b, 0) / simSamples.length;
  
  // Single high-confidence source
  if (topSimilarity >= confidenceThreshold && results.length >= 1) {
    const chunk = results[0].chunk;
    // If chunk looks like a short definition / fact (<200 chars), answer directly
    const direct = chunk.content.trim();
    if (direct.length <= 220) {
      return {
        text: direct,
        sources: createSources(results.slice(0, 1)),
        confidence
      };
    }
  }
  
  // Multiple sources - synthesize
  const topResults = results.slice(0, maxSources);
  const text = synthesizeFromMultiple(topResults, query);
  const sources = createSources(topResults);
  
  // Add URLs if requested
  if (includeUrls) {
    const urls = extractAllUrls(topResults);
    if (urls.length > 0) {
      // URLs will be added by the caller if needed
    }
  }
  
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

  const key = primaryKeyword(query);
  const snippets: string[] = [];
  for (let i = 0; i < Math.min(3, results.length); i++) {
    const c = results[i].chunk.content;
    const snippet = extractFocusedSnippet(c, key, 240);
    if (snippet) snippets.push(snippet);
  }
  const merged = Array.from(new Set(snippets)).join('\n\n');
  return merged.length > 700 ? merged.slice(0, 700).trimEnd() + '…' : merged;
}

function primaryKeyword(query: string): string {
  const cleaned = query.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const tokens = cleaned.split(/\s+/).filter(Boolean).filter(t => !['what','is','the','a','an','of','in','for','to','and','define','explain','who'].includes(t));
  return tokens[0] || cleaned.split(/\s+/)[0] || '';
}

function extractFocusedSnippet(text: string, keyword: string, maxLen: number): string {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  let chosen = sentences.find(s => keyword && s.toLowerCase().includes(keyword));
  if (!chosen) chosen = sentences[0] || text.slice(0, maxLen);
  if (chosen.length > maxLen) chosen = chosen.slice(0, maxLen).trimEnd() + '…';
  return chosen;
}

function trimChunk(text: string, query: string): string {
  const key = primaryKeyword(query);
  return extractFocusedSnippet(text, key, 300);
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
function extractAllUrls(results: SearchResult[]): string[] {
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
 * Format answer with sources and URLs
 */
export function formatAnswer(
  text: string,
  _sources: Source[],  // Prefixed with _ to indicate intentionally unused
  urls: string[] = []
): string {
  let formatted = text;
  
  // Add URLs if available
  if (urls.length > 0) {
    formatted += '\n\n**Related links:**\n';
    formatted += urls.slice(0, 5).map(url => `- ${url}`).join('\n');
  }
  
  return formatted;
}

/**
 * Enhance answer with LLM (to be called by LLM manager)
 */
export function createLLMPrompt(
  query: string,
  context: string,
  conversationHistory?: Array<{ query: string; answer: string }>
): string {
  let prompt = '';
  
  // Add conversation history if available
  if (conversationHistory && conversationHistory.length > 0) {
    prompt += 'Previous conversation:\n';
    conversationHistory.slice(-3).forEach(turn => {
      prompt += `Q: ${turn.query}\nA: ${turn.answer}\n\n`;
    });
  }
  
  // Add current query and context
  prompt += `Context information:\n${context}\n\n`;
  prompt += `Question: ${query}\n\n`;
  prompt += `Please provide a helpful, concise answer based on the context above.`;
  
  return prompt;
}
