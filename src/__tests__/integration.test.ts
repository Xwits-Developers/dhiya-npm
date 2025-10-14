/**
 * Integration tests for DhiyaClient
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DhiyaClient } from '../dhiya-client';
import { KnowledgeSource } from '../core/types';

describe('DhiyaClient Integration', () => {
  let client: DhiyaClient;
  
  beforeEach(async () => {
    // Mock Transformers.js pipeline
    vi.mock('@xenova/transformers', () => ({
      pipeline: vi.fn(async () => {
        return async (text: string | string[]) => {
          // Return mock embeddings (384-dim like all-MiniLM-L6-v2)
          const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
          
          if (Array.isArray(text)) {
            return text.map(() => ({ data: mockEmbedding }));
          }
          return { data: mockEmbedding };
        };
      }),
      env: {
        allowLocalModels: false,
        backends: {}
      }
    }));
    
    client = new DhiyaClient({
      debug: false,
      enableLLM: false // Disable LLM for faster tests
    });
    
    await client.initialize();
  });
  
  afterEach(async () => {
    if (client) {
      await client.destroy();
    }
  });
  
  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const status = await client.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.embedding.ready).toBe(true);
    });
    
    it('should report correct status', async () => {
      const status = await client.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('embedding');
      expect(status).toHaveProperty('knowledgeBase');
      expect(status).toHaveProperty('llm');
    });
  });
  
  describe('Knowledge Loading', () => {
    it('should load JSON knowledge', async () => {
      const source: KnowledgeSource = {
        type: 'json',
        data: [
          { title: 'AI', content: 'Artificial Intelligence is...' },
          { title: 'ML', content: 'Machine Learning is...' }
        ]
      };
      
      await client.loadKnowledge(source);
      
      const status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBeGreaterThan(0);
      expect(status.knowledgeBase.sourceCount).toBe(1);
    });
    
    it('should load text knowledge', async () => {
      const source: KnowledgeSource = {
        type: 'text',
        data: 'This is a test document about artificial intelligence.'
      };
      
      await client.loadKnowledge(source);
      
      const status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBeGreaterThan(0);
    });
    
    it('should handle multiple sources', async () => {
      const source1: KnowledgeSource = {
        type: 'text',
        data: 'First document'
      };
      
      const source2: KnowledgeSource = {
        type: 'text',
        data: 'Second document'
      };
      
      await client.loadKnowledge(source1);
      await client.loadKnowledge(source2);
      
      const status = await client.getStatus();
      // sourceCount reflects chunks (each source is chunked)
      expect(status.knowledgeBase.sourceCount).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('Question Answering', () => {
    beforeEach(async () => {
      const source: KnowledgeSource = {
        type: 'json',
        data: [
          {
            title: 'Machine Learning',
            content: 'Machine learning is a subset of AI that enables systems to learn and improve from experience.'
          },
          {
            title: 'Deep Learning',
            content: 'Deep learning uses neural networks with multiple layers to learn complex patterns.'
          }
        ]
      };
      
      await client.loadKnowledge(source);
    });
    
    it('should answer questions', async () => {
      const answer = await client.ask('What is machine learning?');
      
      expect(answer).toHaveProperty('text');
      expect(answer).toHaveProperty('confidence');
      expect(answer).toHaveProperty('sources');
      expect(answer.text.length).toBeGreaterThan(0);
    });
    
    it('should return relevant sources', async () => {
      const answer = await client.ask('What is machine learning?');
      
      expect(answer.sources.length).toBeGreaterThan(0);
      expect(answer.sources[0]).toHaveProperty('content');
      expect(answer.sources[0]).toHaveProperty('similarity');
    });
    
    it('should calculate confidence scores', async () => {
      const answer = await client.ask('What is machine learning?');
      
      expect(answer.confidence).toBeGreaterThanOrEqual(0);
      expect(answer.confidence).toBeLessThanOrEqual(1);
    });
    
    it('should include timing information', async () => {
      const answer = await client.ask('What is machine learning?');
      
      expect(answer.timing).toHaveProperty('total');
      expect(answer.timing).toHaveProperty('retrieval');
      expect(answer.timing).toHaveProperty('generation');
      expect(answer.timing.total).toBeGreaterThan(0);
    });
  });
  
  describe('Clear Knowledge', () => {
    it('should clear knowledge base', async () => {
      const source: KnowledgeSource = {
        type: 'text',
        data: 'Test data'
      };
      
      await client.loadKnowledge(source);
      
      let status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBeGreaterThan(0);
      
      await client.clear();
      
      status = await client.getStatus();
      expect(status.knowledgeBase.chunkCount).toBe(0);
      expect(status.knowledgeBase.sourceCount).toBe(0);
    });
  });
});
