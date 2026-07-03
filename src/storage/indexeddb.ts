/**
 * IndexedDB storage wrapper
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Chunk, ManifestEntry, CacheEntry } from '../core/types.js';
import { ERROR_MESSAGES } from '../core/config.js';

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
  private initPromise: Promise<void> | null = null;

  constructor(dbName: string = 'dhiya-kb') {
    this.dbName = dbName;
  }

  /**
   * Initialize database. Safe to call concurrently.
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    if (typeof indexedDB === 'undefined') {
      throw new Error(ERROR_MESSAGES.STORAGE_UNAVAILABLE);
    }

    if (!this.initPromise) {
      this.initPromise = this._open().finally(() => {
        this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  private async _open(): Promise<void> {
    this.db = await openDB<DhiyaDB>(this.dbName, this.version, {
      upgrade(db: IDBPDatabase<DhiyaDB>) {
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunkStore.createIndex('by-doc', 'doc_id');
        }

        if (!db.objectStoreNames.contains('manifest')) {
          db.createObjectStore('manifest', { keyPath: 'doc_id' });
        }

        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'query' });
        }
      },
      // Yield the connection so another tab can upgrade the schema
      blocking: () => {
        this.db?.close();
        this.db = null;
      },
      terminated: () => {
        this.db = null;
      }
    });
  }

  private requireDB(): IDBPDatabase<DhiyaDB> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  /**
   * Save chunks. Embeddings are stored as Float32Array (structured clone
   * handles typed arrays natively and halves the on-disk footprint vs
   * float64 plain arrays).
   */
  async saveChunks(chunks: Chunk[]): Promise<void> {
    const db = this.requireDB();

    const tx = db.transaction('chunks', 'readwrite');
    await Promise.all([
      ...chunks.map(chunk =>
        tx.store.put({
          ...chunk,
          embedding:
            chunk.embedding && !(chunk.embedding instanceof Float32Array)
              ? Float32Array.from(chunk.embedding)
              : chunk.embedding
        })
      ),
      tx.done
    ]);
  }

  async getAllChunks(): Promise<Chunk[]> {
    return await this.requireDB().getAll('chunks');
  }

  async getChunksByDocId(docId: string): Promise<Chunk[]> {
    return await this.requireDB().getAllFromIndex('chunks', 'by-doc', docId);
  }

  /**
   * Delete chunks by document ID in a single transaction.
   */
  async deleteChunksByDocId(docId: string): Promise<void> {
    const db = this.requireDB();
    const tx = db.transaction('chunks', 'readwrite');
    const index = tx.store.index('by-doc');

    let cursor = await index.openKeyCursor(docId);
    while (cursor) {
      await tx.store.delete(cursor.primaryKey);
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  async saveManifest(entry: ManifestEntry): Promise<void> {
    await this.requireDB().put('manifest', entry);
  }

  async getManifest(docId: string): Promise<ManifestEntry | undefined> {
    return await this.requireDB().get('manifest', docId);
  }

  async getAllManifests(): Promise<ManifestEntry[]> {
    return await this.requireDB().getAll('manifest');
  }

  async deleteManifest(docId: string): Promise<void> {
    await this.requireDB().delete('manifest', docId);
  }

  /**
   * Cache an answer
   */
  async cacheAnswer(_query: string, entry: CacheEntry): Promise<void> {
    await this.requireDB().put('cache', entry);
  }

  /**
   * Get cached answer. Enforces TTL on read (expired entries are removed)
   * and refreshes the timestamp on hit so eviction is LRU, not FIFO.
   */
  async getCachedAnswer(query: string, ttl?: number): Promise<CacheEntry | undefined> {
    const db = this.requireDB();
    const entry = await db.get('cache', query);
    if (!entry) return undefined;

    if (ttl !== undefined && Date.now() - entry.timestamp > ttl) {
      await db.delete('cache', query);
      return undefined;
    }

    // LRU touch
    const touched = { ...entry, timestamp: Date.now() };
    await db.put('cache', touched);
    return touched;
  }

  /**
   * Clear all cached answers (called when the knowledge base changes).
   */
  async clearCache(): Promise<void> {
    await this.requireDB().clear('cache');
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(ttl: number): Promise<void> {
    const db = this.requireDB();

    const now = Date.now();
    const allEntries = await db.getAll('cache');
    const expired = allEntries.filter((entry: CacheEntry) => now - entry.timestamp > ttl);

    if (expired.length > 0) {
      const tx = db.transaction('cache', 'readwrite');
      await Promise.all([
        ...expired.map((entry: CacheEntry) => tx.store.delete(entry.query)),
        tx.done
      ]);
    }
  }

  /**
   * Limit cache size (least-recently-used eviction)
   */
  async limitCacheSize(maxSize: number): Promise<void> {
    const db = this.requireDB();

    const count = await db.count('cache');
    if (count <= maxSize) return;

    const allEntries = await db.getAll('cache');
    allEntries.sort((a: CacheEntry, b: CacheEntry) => a.timestamp - b.timestamp);

    const toRemove = allEntries.slice(0, allEntries.length - maxSize);
    const tx = db.transaction('cache', 'readwrite');
    await Promise.all([
      ...toRemove.map((entry: CacheEntry) => tx.store.delete(entry.query)),
      tx.done
    ]);
  }

  async getStats(): Promise<{
    chunkCount: number;
    cacheSize: number;
    documentCount: number;
  }> {
    const db = this.requireDB();

    const [chunkCount, cacheSize, documentCount] = await Promise.all([
      db.count('chunks'),
      db.count('cache'),
      db.count('manifest')
    ]);

    return {
      chunkCount,
      cacheSize,
      documentCount
    };
  }

  async clearAll(): Promise<void> {
    const db = this.requireDB();

    const tx = db.transaction(['chunks', 'manifest', 'cache'], 'readwrite');
    await Promise.all([
      tx.objectStore('chunks').clear(),
      tx.objectStore('manifest').clear(),
      tx.objectStore('cache').clear(),
      tx.done
    ]);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
