/**
 * Embedding model management
 */

import { EmbeddingModel, DeviceType, ProgressEvent, ProgressType } from '../core/types';
import { EMBEDDING_MODELS } from '../core/config';
import { selectBestDevice } from '../utils/device';

export class EmbeddingManager {
  private model: any = null;
  private modelName: string | null = null;
  private device: DeviceType = 'wasm';
  private isLoading = false;
  private isReady = false;
  private onProgress?: (event: ProgressEvent) => void;
  
  constructor(onProgress?: (event: ProgressEvent) => void) {
    this.onProgress = onProgress;
  }
  
  /**
   * Initialize the embedding model
   */
  async initialize(modelType: EmbeddingModel, deviceType: DeviceType = 'auto'): Promise<void> {
    if (this.isReady && this.modelName === EMBEDDING_MODELS[modelType].name) {
      return; // Already initialized
    }
    
    if (this.isLoading) {
      throw new Error('Embedding model is already loading');
    }
    
    this.isLoading = true;
    this.emitProgress(ProgressType.EMBEDDING_LOAD, 'Loading embedding model...', 0);
    
    try {
      const { pipeline, env } = await import('@xenova/transformers');
      
      // Configure environment
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      // Select device
      if (deviceType === 'auto') {
        this.device = await selectBestDevice();
      } else {
        this.device = deviceType;
      }
      
      this.emitProgress(ProgressType.EMBEDDING_LOAD, `Using device: ${this.device}`, 25);
      
      // Load model
      const modelName = EMBEDDING_MODELS[modelType].name;
      this.modelName = modelName;
      
      this.emitProgress(ProgressType.EMBEDDING_LOAD, `Downloading ${modelName}...`, 50);
      
      this.model = await pipeline(
        'feature-extraction',
        modelName,
        {
          quantized: true
          // Note: device selection handled automatically by transformers.js
        }
      );
      
      this.isReady = true;
      this.emitProgress(ProgressType.EMBEDDING_LOAD, 'Embedding model ready', 100);
      
    } catch (error) {
      this.isReady = false;
      this.emitProgress(
        ProgressType.ERROR,
        `Failed to load embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0
      );
      throw error;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<number[]> {
    if (!this.isReady || !this.model) {
      throw new Error('Embedding model not initialized');
    }
    
    try {
      const result = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });
      
      // Convert to regular array
      return Array.from(result.data);
    } catch (error) {
      console.error('Embedding failed:', error);
      // Return zero vector as fallback (default 384 dimensions)
      return new Array(384).fill(0);
    }
  }
  
  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[], batchSize: number = 10): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.embed(text))
      );
      embeddings.push(...batchEmbeddings);
      
      // Report progress
      const progress = Math.round((i + batch.length) / texts.length * 100);
      this.emitProgress(
        ProgressType.INDEXING,
        `Embedding batch ${Math.floor(i / batchSize) + 1}...`,
        progress
      );
    }
    
    return embeddings;
  }
  
  /**
   * Check if model is ready
   */
  ready(): boolean {
    return this.isReady;
  }
  
  /**
   * Get current device
   */
  getDevice(): DeviceType {
    return this.device;
  }
  
  /**
   * Get model name
   */
  getModelName(): string | null {
    return this.modelName;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.model = null;
    this.isReady = false;
    this.isLoading = false;
  }
  
  private emitProgress(type: ProgressType, message: string, progress?: number): void {
    if (this.onProgress) {
      this.onProgress({ type, message, progress });
    }
  }
}

// Singleton instance for convenience
let embeddingManagerInstance: EmbeddingManager | null = null;

export function getEmbeddingManager(onProgress?: (event: ProgressEvent) => void): EmbeddingManager {
  if (!embeddingManagerInstance) {
    embeddingManagerInstance = new EmbeddingManager(onProgress);
  }
  return embeddingManagerInstance;
}
