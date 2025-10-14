/**
 * IndexedDB storage wrapper
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Chunk, ManifestEntry, CacheEntry } from '../core/types';

interface DhiyaDB extends DBSchema {
  chunks: {
    key: string;
    value: Chunk;
    indexes: { 'by-doc': string };
  };
  manifest: {
    key: string;
    value: ManifestEntry;
  };
  cache: {
    key: string;
    value: CacheEntry;
  };
}

export class StorageManager {
  private db: IDBPDatabase<DhiyaDB> | null = null;
  private dbName: string;
  private version = 1;
  
  constructor(dbName: string = 'dhiya-kb') {
    this.dbName = dbName;
  }
  
  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    this.db = await openDB<DhiyaDB>(this.dbName, this.version, {
      upgrade(db: IDBPDatabase<DhiyaDB>) {
        // Chunks store
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunkStore.createIndex('by-doc', 'doc_id');
        }
        
        // Manifest store
        if (!db.objectStoreNames.contains('manifest')) {
          db.createObjectStore('manifest', { keyPath: 'doc_id' });
        }
        
        // Cache store
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'query' });
        }
      }
    });
  }
  
  /**
   * Save chunks
   */
  async saveChunks(chunks: Chunk[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tx = this.db.transaction('chunks', 'readwrite');
    await Promise.all([
      ...chunks.map(chunk => tx.store.put(chunk)),
      tx.done
    ]);
  }
  
  /**
   * Get all chunks
   */
  async getAllChunks(): Promise<Chunk[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('chunks');
  }
  
  /**
   * Get chunks by document ID
   */
  async getChunksByDocId(docId: string): Promise<Chunk[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllFromIndex('chunks', 'by-doc', docId);
  }
  
  /**
   * Delete chunks by document ID
   */
  async deleteChunksByDocId(docId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const chunks = await this.getChunksByDocId(docId);
    const tx = this.db.transaction('chunks', 'readwrite');
    await Promise.all([
      ...chunks.map(chunk => tx.store.delete(chunk.id)),
      tx.done
    ]);
  }
  
  /**
   * Save manifest entry
   */
  async saveManifest(entry: ManifestEntry): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('manifest', entry);
  }
  
  /**
   * Get manifest entry
   */
  async getManifest(docId: string): Promise<ManifestEntry | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.get('manifest', docId);
  }
  
  /**
   * Get all manifests
   */
  async getAllManifests(): Promise<ManifestEntry[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('manifest');
  }
  
  /**
   * Cache an answer
   */
  async cacheAnswer(_query: string, entry: CacheEntry): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('cache', entry);
  }
  
  /**
   * Get cached answer
   */
  async getCachedAnswer(query: string): Promise<CacheEntry | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.get('cache', query);
  }
  
  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(ttl: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const allEntries = await this.db.getAll('cache');
    const expired = allEntries.filter((entry: CacheEntry) => now - entry.timestamp > ttl);
    
    if (expired.length > 0) {
      const tx = this.db.transaction('cache', 'readwrite');
      await Promise.all([
        ...expired.map((entry: CacheEntry) => tx.store.delete(entry.query)),
        tx.done
      ]);
    }
  }
  
  /**
   * Limit cache size (LRU eviction)
   */
  async limitCacheSize(maxSize: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const allEntries = await this.db.getAll('cache');
    
    if (allEntries.length > maxSize) {
      // Sort by timestamp (oldest first)
      allEntries.sort((a: CacheEntry, b: CacheEntry) => a.timestamp - b.timestamp);
      
      // Remove oldest entries
      const toRemove = allEntries.slice(0, allEntries.length - maxSize);
      const tx = this.db.transaction('cache', 'readwrite');
      await Promise.all([
        ...toRemove.map((entry: CacheEntry) => tx.store.delete(entry.query)),
        tx.done
      ]);
    }
  }
  
  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    chunkCount: number;
    cacheSize: number;
    documentCount: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const [chunkCount, cacheSize, manifests] = await Promise.all([
      this.db.count('chunks'),
      this.db.count('cache'),
      this.db.getAll('manifest')
    ]);
    
    return {
      chunkCount,
      cacheSize,
      documentCount: manifests.length
    };
  }
  
  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tx = this.db.transaction(['chunks', 'manifest', 'cache'], 'readwrite');
    await Promise.all([
      tx.objectStore('chunks').clear(),
      tx.objectStore('manifest').clear(),
      tx.objectStore('cache').clear(),
      tx.done
    ]);
  }
  
  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
