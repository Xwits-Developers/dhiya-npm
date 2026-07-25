/**
 * Text normalization and preprocessing utilities
 */

/**
 * Common English stop words
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have'
]);

/**
 * Normalize query text. Unicode-aware: letters and digits in any script
 * are preserved so multilingual queries survive normalization.
 */
export function normalizeQuery(query: string): string {
  const normalized = query
    .toLowerCase()
    // Keep letters, combining marks (Devanagari matras etc.), digits in any
    // script, whitespace, hyphens and apostrophes
    .replace(/[^\p{L}\p{M}\p{N}\s'-]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');

  // Never normalize down to an empty string (would collide in the cache)
  return normalized || query.trim().toLowerCase();
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
 * Clean text content. Paragraph structure (blank lines) is preserved so the
 * chunker can split on natural boundaries.
 */
export function cleanText(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n?/g, '\n')
    // Remove control characters except newline/tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse horizontal whitespace runs
    .replace(/[ \t]+/g, ' ')
    // Trim spaces around newlines
    .replace(/ ?\n ?/g, '\n')
    // Collapse 3+ newlines into a paragraph break
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract URLs from text.
 *
 * Trailing punctuation is stripped: prose almost always ends a sentence right
 * after a link, and keeping the period would both break the link and make
 * `https://x/y.` and `https://x/y` look like two different URLs to callers that
 * de-duplicate. Closing brackets are only dropped when unbalanced, so URLs that
 * legitimately contain them (Wikipedia's `Foo_(bar)`) survive intact.
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  const matches = text.match(urlRegex) || [];

  return matches
    .map(url => {
      let trimmed = url;
      // Strip one trailing character at a time so runs like `).` are handled.
      for (;;) {
        const last = trimmed[trimmed.length - 1];
        if (last === undefined) break;

        if ('.,;:!?\'"'.includes(last)) {
          trimmed = trimmed.slice(0, -1);
          continue;
        }
        if (last === ')' || last === ']') {
          const open = last === ')' ? '(' : '[';
          const opens = trimmed.split(open).length - 1;
          const closes = trimmed.split(last).length - 1;
          if (closes > opens) {
            trimmed = trimmed.slice(0, -1);
            continue;
          }
        }
        break;
      }
      return trimmed;
    })
    .filter(url => /^https?:\/\/[^/]+/.test(url));
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
