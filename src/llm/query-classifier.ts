/**
 * Query type classification for smart LLM usage
 */

export enum QueryType {
  KNOWLEDGE_BASE = 'knowledge-base',  // Questions about indexed content
  GENERAL = 'general',                // General questions
  CONVERSATIONAL = 'conversational',  // Greetings, thanks, etc.
  OUT_OF_SCOPE = 'out-of-scope'      // Unrelated queries
}

/**
 * Classify query type
 */
export function classifyQuery(query: string): QueryType {
  const lowerQuery = query.toLowerCase().trim();
  
  // Conversational patterns
  if (isConversational(lowerQuery)) {
    return QueryType.CONVERSATIONAL;
  }
  
  // Out of scope patterns
  if (isOutOfScope(lowerQuery)) {
    return QueryType.OUT_OF_SCOPE;
  }
  
  // Question patterns suggest knowledge base query
  if (isQuestionPattern(lowerQuery)) {
    return QueryType.KNOWLEDGE_BASE;
  }
  
  // Default to general
  return QueryType.GENERAL;
}

/**
 * Check if query is conversational
 */
export function isConversational(query: string): boolean {
  const conversationalPatterns = [
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/,
    /(how are you|what's up|whats up)/,
    /(thanks|thank you|thx|ty)/,
    /^(bye|goodbye|see you|farewell)/,
    /^(ok|okay|sure|alright|cool|great|awesome)/,
    /^(yes|yeah|yep|no|nope|nah)/
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(query));
}

/**
 * Check if query is out of scope
 */
export function isOutOfScope(query: string): boolean {
  // Time-sensitive queries
  const timePatterns = [
    /what time is it/i,
    /what'?s the time/i,
    /current time/i,
    /today'?s date/i,
    /what'?s today'?s date/i,
    /what is today'?s date/i,
    /what date is it/i
  ];
  
  // Weather queries
  const weatherPatterns = [
    /weather/i,
    /raining/i,
    /forecast/i,
    /temperature/i
  ];
  
  // Action requests
  const actionPatterns = [
    /send (an? )?(email|message)/i,
    /call someone/i,
    /make (a )?call/i,
    /open (a )?file/i,
    /start (a )?program/i
  ];
  
  // Real-time info
  const realtimePatterns = [
    /stock price/i,
    /current news/i,
    /latest news/i,
    /breaking news/i
  ];
  
  // Check all out-of-scope patterns first
  const isOutOfScopeQuery = timePatterns.some(pattern => pattern.test(query)) ||
         weatherPatterns.some(pattern => pattern.test(query)) ||
         actionPatterns.some(pattern => pattern.test(query)) ||
         realtimePatterns.some(pattern => pattern.test(query));
  
  if (!isOutOfScopeQuery) {
    return false; // Not out of scope
  }
  
  // However, "explain the weather system" is a knowledge query, not out of scope
  // Check if it's actually asking for explanation/knowledge
  const knowledgeIndicators = [
    /explain (the|a)?/i,
    /how does (the|a)?/i,
    /tell me about (the|a)?/i,
    /describe (the|a)?/i,
    /what is (the|a)? .+ (system|concept|theory|principle)/i
  ];
  
  // Check if it's a knowledge question about the topic (override)
  const hasKnowledgeIndicator = knowledgeIndicators.some(pattern => pattern.test(query));
  if (hasKnowledgeIndicator) {
    return false; // It's a knowledge query, not out of scope
  }
  
  return true;
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
      return true; // Use LLM to enhance RAG results
    case QueryType.GENERAL:
      return true; // Use LLM for general questions
    case QueryType.CONVERSATIONAL:
      return false; // Use simple responses
    case QueryType.OUT_OF_SCOPE:
      return false; // Politely decline
    default:
      return false;
  }
}

/**
 * Get conversational response
 */
export function getConversationalResponse(query: string): string {
  const lowerQuery = query.toLowerCase().trim();
  
  if (/^(hi|hello|hey)/.test(lowerQuery)) {
    return "Hello! How can I help you today?";
  }
  
  if (/^(thanks|thank you)/.test(lowerQuery)) {
    return "You're welcome! Feel free to ask if you have more questions.";
  }
  
  if (/^(bye|goodbye)/.test(lowerQuery)) {
    return "Goodbye! Have a great day!";
  }
  
  if (/^(ok|okay|sure|alright)/.test(lowerQuery)) {
    return "Great! Anything else I can help with?";
  }
  
  return "I'm here to help! What would you like to know?";
}

/**
 * Get out of scope response
 */
export function getOutOfScopeResponse(): string {
  return "I'm focused on answering questions about the knowledge base. I can't help with that particular topic, but feel free to ask me anything within my domain!";
}
