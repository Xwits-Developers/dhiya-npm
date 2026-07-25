/**
 * Unit tests for text normalization
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeQuery,
  removeStopWords,
  cleanText,
  extractUrls,
  hashText
} from '../utils/normalize';

describe('Normalize Utils', () => {
  describe('cleanText', () => {
    it('should remove extra whitespace', () => {
      const text = 'This   has    extra   spaces';
      const cleaned = cleanText(text);
      
      expect(cleaned).toBe('This has extra spaces');
    });
    
    it('should trim whitespace', () => {
      const text = '  text with spaces  ';
      const cleaned = cleanText(text);
      
      expect(cleaned).toBe('text with spaces');
    });
    
    it('should handle empty strings', () => {
      expect(cleanText('')).toBe('');
      expect(cleanText('   ')).toBe('');
    });
  });
  
  describe('normalizeQuery', () => {
    it('should lowercase text', () => {
      const query = 'This Is A TEST';
      const normalized = normalizeQuery(query);
      
      expect(normalized).toBe('this is a test');
    });
    
    it('should remove punctuation', () => {
      const query = 'Hello, world! How are you?';
      const normalized = normalizeQuery(query);
      
      expect(normalized).not.toContain(',');
      expect(normalized).not.toContain('!');
      expect(normalized).not.toContain('?');
    });
    
    it('should clean whitespace', () => {
      const query = '  Extra   spaces  ';
      const normalized = normalizeQuery(query);

      expect(normalized).toBe('extra spaces');
    });

    it('regression: preserves non-Latin scripts', () => {
      expect(normalizeQuery('क्या है कीमत?')).toBe('क्या है कीमत');
      expect(normalizeQuery('什么是价格')).toBe('什么是价格');
      expect(normalizeQuery('café pricing')).toBe('café pricing');
    });

    it('regression: never returns an empty string for non-empty input', () => {
      expect(normalizeQuery('!!!')).not.toBe('');
      expect(normalizeQuery('¿?')).not.toBe('');
    });
  });

  describe('cleanText paragraph preservation', () => {
    it('regression: keeps paragraph breaks for the chunker', () => {
      const text = 'Paragraph one.\n\nParagraph two.';
      expect(cleanText(text)).toBe('Paragraph one.\n\nParagraph two.');
    });

    it('collapses excessive blank lines to one break', () => {
      expect(cleanText('A\n\n\n\n\nB')).toBe('A\n\nB');
    });
  });
  
  describe('removeStopWords', () => {
    it('should remove common stop words', () => {
      const text = 'the quick brown fox jumps over the lazy dog';
      const filtered = removeStopWords(text);
      
      expect(filtered).not.toContain('the');
      expect(filtered).toContain('quick');
      expect(filtered).toContain('brown');
      expect(filtered).toContain('fox');
    });
    
    it('should preserve important words', () => {
      const text = 'artificial intelligence machine learning';
      const filtered = removeStopWords(text);
      
      expect(filtered).toContain('artificial');
      expect(filtered).toContain('intelligence');
      expect(filtered).toContain('machine');
      expect(filtered).toContain('learning');
    });
  });
  
  describe('extractUrls', () => {
    it('should extract HTTP URLs', () => {
      const text = 'Check out https://example.com for more info';
      const urls = extractUrls(text);
      
      expect(urls).toContain('https://example.com');
    });
    
    it('should extract multiple URLs', () => {
      const text = 'Visit http://site1.com and https://site2.com';
      const urls = extractUrls(text);
      
      expect(urls.length).toBe(2);
      expect(urls).toContain('http://site1.com');
      expect(urls).toContain('https://site2.com');
    });
    
    it('should return empty array for no URLs', () => {
      const text = 'No URLs here';
      const urls = extractUrls(text);

      expect(urls).toEqual([]);
    });

    it('should strip trailing sentence punctuation', () => {
      const text = 'Book at https://calendly.com/xwits/30min.';
      const urls = extractUrls(text);

      expect(urls).toEqual(['https://calendly.com/xwits/30min']);
    });

    it('should treat a sentence-final URL as the same link as a bare one', () => {
      const text =
        'Schedule at https://calendly.com/xwits/30min. Or reuse https://calendly.com/xwits/30min';
      const unique = new Set(extractUrls(text));

      expect(unique.size).toBe(1);
    });

    it('should keep balanced parentheses inside a URL', () => {
      const text = 'See https://en.wikipedia.org/wiki/Foo_(bar) for details';
      const urls = extractUrls(text);

      expect(urls).toEqual(['https://en.wikipedia.org/wiki/Foo_(bar)']);
    });

    it('should drop an unbalanced closing parenthesis', () => {
      const text = 'Details (see https://example.com/docs) follow';
      const urls = extractUrls(text);

      expect(urls).toEqual(['https://example.com/docs']);
    });
  });
  
  describe('hashText', () => {
    it('should generate consistent hashes', async () => {
      const text = 'test text';
      const hash1 = await hashText(text);
      const hash2 = await hashText(text);
      
      expect(hash1).toBe(hash2);
    });
    
    it('should generate different hashes for different text', async () => {
      const hash1 = await hashText('text one');
      const hash2 = await hashText('text two');
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should return string hash', async () => {
      const hash = await hashText('test');
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });
});
