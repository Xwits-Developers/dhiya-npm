/**
 * Unit tests for query classifier
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
    it('should identify greetings', () => {
      expect(isConversational('hello')).toBe(true);
      expect(isConversational('hi there')).toBe(true);
      expect(isConversational('hey')).toBe(true);
    });
    
    it('should identify common phrases', () => {
      expect(isConversational('how are you')).toBe(true);
      expect(isConversational('thanks')).toBe(true);
      expect(isConversational('bye')).toBe(true);
    });
    
    it('should not flag knowledge queries', () => {
      expect(isConversational('what is machine learning')).toBe(false);
      expect(isConversational('explain neural networks')).toBe(false);
    });
  });
  
  describe('isOutOfScope', () => {
    it('should identify time-sensitive queries', () => {
      expect(isOutOfScope('what time is it')).toBe(true);
      expect(isOutOfScope('what is today\'s date')).toBe(true);
    });
    
    it('should identify weather queries', () => {
      expect(isOutOfScope('what\'s the weather')).toBe(true);
      expect(isOutOfScope('is it raining')).toBe(true);
    });
    
    it('should identify action requests', () => {
      expect(isOutOfScope('send an email')).toBe(true);
      expect(isOutOfScope('call someone')).toBe(true);
    });
    
    it('should not flag knowledge queries', () => {
      expect(isOutOfScope('what is artificial intelligence')).toBe(false);
      expect(isOutOfScope('explain the weather system')).toBe(false);
    });
  });
  
  describe('classifyQuery', () => {
    it('should classify conversational queries', () => {
      const type = classifyQuery('hello');
      expect(type).toBe(QueryType.CONVERSATIONAL);
    });
    
    it('should classify out-of-scope queries', () => {
      const type = classifyQuery('what time is it');
      expect(type).toBe(QueryType.OUT_OF_SCOPE);
    });
    
    it('should classify knowledge-base queries', () => {
      const type = classifyQuery('what is deep learning');
      expect(type).toBe(QueryType.KNOWLEDGE_BASE);
    });
    
    it('should classify general queries', () => {
      const type = classifyQuery('tell me something interesting');
      expect(type).toBe(QueryType.GENERAL);
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
      // With LLM enabled, should use it
      expect(shouldUseLLM(QueryType.KNOWLEDGE_BASE, true)).toBe(true);
      
      // With LLM disabled, should not use it
      expect(shouldUseLLM(QueryType.KNOWLEDGE_BASE, false)).toBe(false);
    });
  });
});
