/**
 * Text normalization and preprocessing utilities
 */

/**
 * Common English stop words
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have'
]);

/**
 * Normalize query text
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    // Remove punctuation except hyphens and apostrophes within words
    .replace(/[^\w\s'-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Remove stop words from query
 */
export function removeStopWords(query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  const filtered = words.filter(word => !STOP_WORDS.has(word));
  return filtered.join(' ');
}

/**
 * Clean text content
 */
export function cleanText(text: string): string {
  return text
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Trim
    .trim();
}

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  const matches = text.match(urlRegex);
  return matches || [];
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Calculate SHA-256 hash of text (for checksums)
 */
export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
