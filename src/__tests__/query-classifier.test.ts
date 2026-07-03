/**
 * Unit tests for query classifier.
 *
 * The v2 classifier is deliberately conservative: only whole-message small
 * talk is conversational, and only direct action requests are out of scope.
 * Everything else must reach retrieval.
 */

import { describe, it, expect } from 'vitest';
import {
  QueryType,
  classifyQuery,
  isConversational,
  isOutOfScope,
  shouldUseLLM
} from '../llm/query-classifier';

describe('Query Classifier', () => {
  describe('isConversational', () => {
    it('should identify pure greetings', () => {
      expect(isConversational('hello')).toBe(true);
      expect(isConversational('hi there')).toBe(true);
      expect(isConversational('hey!')).toBe(true);
      expect(isConversational('good morning')).toBe(true);
    });

    it('should identify common phrases', () => {
      expect(isConversational('how are you')).toBe(true);
      expect(isConversational('thanks')).toBe(true);
      expect(isConversational('thank you so much!')).toBe(true);
      expect(isConversational('bye')).toBe(true);
      expect(isConversational('ok')).toBe(true);
    });

    it('should not flag knowledge queries', () => {
      expect(isConversational('what is machine learning')).toBe(false);
      expect(isConversational('explain neural networks')).toBe(false);
    });

    it('regression: substrings of real questions must never match', () => {
      // "ty" used to match anywhere ("warranty", "security", "safety")
      expect(isConversational('what is the warranty policy')).toBe(false);
      expect(isConversational('how do you handle security')).toBe(false);
      expect(isConversational('tell me about safety features')).toBe(false);
      // "hi" prefix used to match "history"
      expect(isConversational('history of the company')).toBe(false);
      // "no" prefix used to match "notification"
      expect(isConversational('notification settings')).toBe(false);
      // "great" prefix used to match sentences starting with "great"
      expect(isConversational('great wall of china facts')).toBe(false);
      // "yes" prefix used to match "yesterday"
      expect(isConversational("yesterday's report summary")).toBe(false);
      // thanks embedded in a real question
      expect(isConversational('how do I customize the thank you email')).toBe(false);
    });
  });

  describe('isOutOfScope', () => {
    it('should identify direct action requests', () => {
      expect(isOutOfScope('send an email to john')).toBe(true);
      expect(isOutOfScope('call 555-0100')).toBe(true);
      expect(isOutOfScope('open a file for me')).toBe(true);
    });

    it('should never flag informational questions', () => {
      expect(isOutOfScope('what is artificial intelligence')).toBe(false);
      expect(isOutOfScope('explain the weather system')).toBe(false);
      // These used to be refused by keyword matching:
      expect(isOutOfScope('how do I create a sales forecast')).toBe(false);
      expect(isOutOfScope('what temperature should the server room be')).toBe(false);
      expect(isOutOfScope('what time is checkout')).toBe(false);
      expect(isOutOfScope('does the plan include weather data')).toBe(false);
    });
  });

  describe('classifyQuery', () => {
    it('should classify conversational queries', () => {
      expect(classifyQuery('hello')).toBe(QueryType.CONVERSATIONAL);
    });

    it('should classify action requests as out of scope', () => {
      expect(classifyQuery('send an email to support')).toBe(QueryType.OUT_OF_SCOPE);
    });

    it('should classify knowledge-base queries', () => {
      expect(classifyQuery('what is deep learning')).toBe(QueryType.KNOWLEDGE_BASE);
      expect(classifyQuery('what is the warranty period?')).toBe(QueryType.KNOWLEDGE_BASE);
    });

    it('should classify general queries', () => {
      expect(classifyQuery('tell me something interesting')).toBe(QueryType.GENERAL);
    });
  });

  describe('shouldUseLLM', () => {
    it('should use LLM for general queries', () => {
      expect(shouldUseLLM(QueryType.GENERAL, true)).toBe(true);
    });

    it('should not use LLM for conversational queries', () => {
      expect(shouldUseLLM(QueryType.CONVERSATIONAL, true)).toBe(false);
    });

    it('should not use LLM for out-of-scope queries', () => {
      expect(shouldUseLLM(QueryType.OUT_OF_SCOPE, true)).toBe(false);
    });

    it('should use LLM conditionally for knowledge-base queries', () => {
      expect(shouldUseLLM(QueryType.KNOWLEDGE_BASE, true)).toBe(true);
      expect(shouldUseLLM(QueryType.KNOWLEDGE_BASE, false)).toBe(false);
    });
  });
});
