/**
 * Unit tests for similarity functions
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector
} from '../utils/similarity';

describe('Similarity Utils', () => {
  describe('normalizeVector', () => {
    it('should normalize a vector to unit length', () => {
      const vector = [3, 4]; // Length = 5
      const normalized = normalizeVector(vector);
      
      expect(normalized[0]).toBeCloseTo(0.6);
      expect(normalized[1]).toBeCloseTo(0.8);
      
      // Check magnitude is 1
      const magnitude = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1);
    });
    
    it('should handle zero vectors', () => {
      const vector = [0, 0, 0];
      const normalized = normalizeVector(vector);
      
      expect(normalized).toEqual([0, 0, 0]);
    });
  });
  
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];
      
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1);
    });
    
    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0);
    });
    
    it('should return -1 for opposite vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1);
    });
    
    it('should handle different magnitudes', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [2, 4, 6]; // Same direction, different magnitude
      
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1);
    });
  });
  
  describe('euclideanDistance', () => {
    it('should return 0 for identical vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];
      
      const distance = euclideanDistance(vec1, vec2);
      expect(distance).toBe(0);
    });
    
    it('should calculate correct distance', () => {
      const vec1 = [0, 0];
      const vec2 = [3, 4]; // Distance = 5
      
      const distance = euclideanDistance(vec1, vec2);
      expect(distance).toBeCloseTo(5);
    });
    
    it('should be symmetric', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];
      
      const dist1 = euclideanDistance(vec1, vec2);
      const dist2 = euclideanDistance(vec2, vec1);
      
      expect(dist1).toBe(dist2);
    });
  });
});
