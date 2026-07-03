/**
 * Query type classification.
 *
 * Deliberately conservative: only queries that are entirely small talk
 * (greetings, thanks, goodbyes) are classified as conversational. Everything
 * else goes through retrieval — if the knowledge base has nothing relevant,
 * low similarity already produces an honest "no answer" response, which is
 * far safer than keyword-based refusal.
 */

export enum QueryType {
  KNOWLEDGE_BASE = 'knowledge-base', // Questions about indexed content
  GENERAL = 'general',               // General questions
  CONVERSATIONAL = 'conversational', // Greetings, thanks, etc.
  OUT_OF_SCOPE = 'out-of-scope'      // Direct action requests we cannot do
}

/**
 * Classify query type
 */
export function classifyQuery(query: string): QueryType {
  const lowerQuery = query.toLowerCase().trim();

  if (isConversational(lowerQuery)) {
    return QueryType.CONVERSATIONAL;
  }

  if (isOutOfScope(lowerQuery)) {
    return QueryType.OUT_OF_SCOPE;
  }

  if (isQuestionPattern(lowerQuery)) {
    return QueryType.KNOWLEDGE_BASE;
  }

  return QueryType.GENERAL;
}

/** Terminal punctuation/emoji tolerated around small talk. */
const TRAILER = "[\\s!.,?'\\u{1F300}-\\u{1FAFF}]*";

const CONVERSATIONAL_PATTERNS: RegExp[] = [
  // Pure greetings: "hi", "hello there", "hey!", "good morning"
  new RegExp(`^(hi|hii+|hello|hey|yo|greetings|good (morning|afternoon|evening))( there)?( dhiya)?${TRAILER}$`, 'iu'),
  // "how are you", "what's up"
  new RegExp(`^(how are you|how's it going|what's up|whats up|sup)${TRAILER}$`, 'iu'),
  // Pure thanks: "thanks", "thank you so much", "thx"
  new RegExp(`^(ok(ay)?[\\s,]*)?(thanks|thank you|thankyou|thx|ty|tysm)( a lot| so much| very much)?${TRAILER}$`, 'iu'),
  // Goodbyes
  new RegExp(`^(bye|goodbye|see you|see ya|farewell|good night)${TRAILER}$`, 'iu'),
  // Bare acknowledgements: "ok", "cool", "great", "yes", "no"
  new RegExp(`^(ok|okay|sure|alright|cool|great|awesome|nice|perfect|got it|yes|yeah|yep|no|nope|nah)${TRAILER}$`, 'iu')
];

/**
 * Check if the ENTIRE query is small talk. Substrings never match, so
 * questions like "what is the warranty?" or "history of the company" are
 * always routed to retrieval.
 */
export function isConversational(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  // Small talk is short; anything long deserves retrieval
  if (trimmed.split(/\s+/).length > 6) return false;

  return CONVERSATIONAL_PATTERNS.some(pattern => pattern.test(trimmed));
}

const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  // Direct action requests a client-side chatbot cannot perform
  /^(please\s+)?(send|write|compose)\s+(an?\s+)?(email|e-mail|text message|sms)\b/i,
  /^(please\s+)?(call|phone|dial)\s+/i,
  /^(please\s+)?(open|launch|start)\s+(a\s+)?(file|program|app|application)\b/i
];

/**
 * Check if the query is a direct action request that cannot be served.
 * Informational questions are never out of scope — retrieval decides.
 */
export function isOutOfScope(query: string): boolean {
  return OUT_OF_SCOPE_PATTERNS.some(pattern => pattern.test(query.trim()));
}

/**
 * Check if query has question pattern
 */
function isQuestionPattern(query: string): boolean {
  const questionWords = ['what', 'who', 'where', 'when', 'why', 'how', 'which', 'can', 'does', 'is', 'are'];
  const startsWithQuestion = questionWords.some(word => query.startsWith(word + ' '));
  const endsWithQuestion = query.endsWith('?');

  return startsWithQuestion || endsWithQuestion;
}

/**
 * Determine if LLM should be used for this query type
 */
export function shouldUseLLM(queryType: QueryType, enableLLM: boolean): boolean {
  if (!enableLLM) return false;

  switch (queryType) {
    case QueryType.KNOWLEDGE_BASE:
    case QueryType.GENERAL:
      return true;
    case QueryType.CONVERSATIONAL:
    case QueryType.OUT_OF_SCOPE:
      return false;
    default:
      return false;
  }
}

/**
 * Get conversational response
 */
export function getConversationalResponse(query: string): string {
  const lowerQuery = query.toLowerCase().trim();

  if (/^(thanks|thank you|thankyou|thx|ty|tysm)\b/.test(lowerQuery) || /\b(thanks|thank you)\b/.test(lowerQuery)) {
    return "You're welcome! Feel free to ask if you have more questions.";
  }

  if (/^(bye|goodbye|see you|see ya|farewell|good night)\b/.test(lowerQuery)) {
    return 'Goodbye! Have a great day!';
  }

  if (/^(ok|okay|sure|alright|cool|great|awesome|nice|perfect|got it|yes|yeah|yep|no|nope|nah)\b/.test(lowerQuery)) {
    return 'Great! Anything else I can help with?';
  }

  return 'Hello! Ask me anything about the knowledge base.';
}

/**
 * Get out of scope response
 */
export function getOutOfScopeResponse(): string {
  return "I can only answer questions about the knowledge base — I can't perform actions like sending messages or opening apps.";
}
