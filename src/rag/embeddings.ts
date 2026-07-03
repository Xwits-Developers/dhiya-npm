/**
 * Embedding model management (Transformers.js v4, WebGPU with WASM fallback)
 */

import { EmbeddingModel, DeviceType, ProgressEvent, ProgressType } from '../core/types.js';
import { EMBEDDING_MODELS } from '../core/config.js';
import { selectBestDevice } from '../utils/device.js';

export class EmbeddingManager {
  private model: any = null;
  private modelName: string | null = null;
  private device: Exclude<DeviceType, 'auto'> = 'wasm';
  private isLoading = false;
  private isReady = false;

  /** True while the model is downloading/initializing. */
  loading(): boolean {
    return this.isLoading;
  }
  private initPromise: Promise<void> | null = null;
  private onProgress?: (event: ProgressEvent) => void;

  constructor(onProgress?: (event: ProgressEvent) => void) {
    this.onProgress = onProgress;
  }

  /**
   * Initialize the embedding model
   */
  async initialize(modelType: EmbeddingModel, deviceType: DeviceType = 'auto'): Promise<void> {
    if (this.isReady && this.modelName === EMBEDDING_MODELS[modelType].name) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize(modelType, deviceType).finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async _initialize(modelType: EmbeddingModel, deviceType: DeviceType): Promise<void> {
    this.isLoading = true;
    this.emitProgress(ProgressType.EMBEDDING_LOAD, 'Loading embedding model...', 0);

    try {
      const { pipeline, env } = await import('@huggingface/transformers');

      env.allowLocalModels = false;
      env.useBrowserCache = true;

      const requested = deviceType === 'auto' ? await selectBestDevice() : deviceType;
      const modelName = EMBEDDING_MODELS[modelType].name;

      this.emitProgress(ProgressType.EMBEDDING_LOAD, `Downloading ${modelName}...`, 30);

      this.model = await this.loadPipeline(pipeline, modelName, requested);
      this.modelName = modelName;

      this.isReady = true;
      this.emitProgress(
        ProgressType.EMBEDDING_LOAD,
        `Embedding model ready (${this.device})`,
        100
      );
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

  private async loadPipeline(
    pipelineFn: any,
    modelName: string,
    requested: Exclude<DeviceType, 'auto'>
  ): Promise<any> {
    try {
      const model = await pipelineFn('feature-extraction', modelName, {
        device: requested,
        dtype: requested === 'webgpu' ? 'fp32' : 'q8'
      });
      this.device = requested;
      return model;
    } catch (error) {
      if (requested === 'webgpu') {
        // WebGPU adapters can fail at model load time; retry on WASM
        this.emitProgress(
          ProgressType.EMBEDDING_LOAD,
          'WebGPU unavailable, falling back to WASM...',
          40
        );
        const model = await pipelineFn('feature-extraction', modelName, {
          device: 'wasm',
          dtype: 'q8'
        });
        this.device = 'wasm';
        return model;
      }
      throw error;
    }
  }

  /**
   * Generate embedding for text. Throws on failure — a corrupted (zero)
   * vector must never be persisted to the index.
   */
  async embed(text: string): Promise<Float32Array> {
    if (!this.isReady || !this.model) {
      throw new Error('Embedding model not initialized');
    }

    const result = await this.model(text, {
      pooling: 'mean',
      normalize: true
    });

    return result.data instanceof Float32Array
      ? result.data
      : Float32Array.from(result.data);
  }

  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[], batchSize: number = 8): Promise<Float32Array[]> {
    const embeddings: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
      for (const text of batch) {
        embeddings.push(await this.embed(text));
      }

      const progress = Math.round(((i + batch.length) / texts.length) * 100);
      this.emitProgress(
        ProgressType.INDEXING,
        `Embedded ${Math.min(i + batch.length, texts.length)}/${texts.length} chunks`,
        progress
      );
    }

    return embeddings;
  }

  ready(): boolean {
    return this.isReady;
  }

  getDevice(): DeviceType {
    return this.device;
  }

  getModelName(): string | null {
    return this.modelName;
  }

  async cleanup(): Promise<void> {
    if (this.model && typeof this.model.dispose === 'function') {
      try {
        await this.model.dispose();
      } catch {
        // best-effort disposal
      }
    }
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
