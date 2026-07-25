/**
 * Transformers.js Provider — runs an instruct model locally in the browser
 * via WebGPU (with WASM fallback) using @huggingface/transformers.
 */

import { ILLMProvider, LLMGenerateOptions, LLMLoadProgressCallback } from './base.js';
import { LLMProvider, TransformersOptions } from '../core/types.js';
import { DEFAULT_TRANSFORMERS_OPTIONS } from './config.js';

export class TransformersProvider implements ILLMProvider {
  name = LLMProvider.TRANSFORMERS;
  private generator: any = null;
  private streamerCtor: any = null;
  private stoppingCriteriaCtor: any = null;
  private loadPromise: Promise<void> | null = null;
  private options: TransformersOptions;
  private onLoadProgress?: LLMLoadProgressCallback;
  /** Bytes seen per file so the reported percentage is an aggregate, not per-file. */
  private fileBytes = new Map<string, { loaded: number; total: number }>();

  constructor(
    options: TransformersOptions = DEFAULT_TRANSFORMERS_OPTIONS,
    onLoadProgress?: LLMLoadProgressCallback
  ) {
    this.options = { ...options };
    this.onLoadProgress = onLoadProgress;
  }

  setLoadProgressCallback(callback?: LLMLoadProgressCallback): void {
    this.onLoadProgress = callback;
  }

  setOptions(options: Partial<TransformersOptions>): void {
    this.options = { ...this.options, ...options };
    void this.disposeGenerator();
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined') return false;
      return 'gpu' in navigator || typeof WebAssembly !== 'undefined';
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (this.generator) return;

    if (!this.loadPromise) {
      this.loadPromise = this._loadModel().finally(() => {
        this.loadPromise = null;
      });
    }
    return this.loadPromise;
  }

  private async _loadModel(): Promise<void> {
    const transformers: any = await import('@huggingface/transformers');
    const { pipeline, env, TextStreamer } = transformers;

    env.allowLocalModels = this.options.allowLocalModels;
    env.useBrowserCache = this.options.useBrowserCache;
    this.streamerCtor = TextStreamer;
    // Lets an AbortSignal interrupt the decode loop mid-generation
    this.stoppingCriteriaCtor = transformers.InterruptableStoppingCriteria ?? null;

    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const requested =
      this.options.device && this.options.device !== 'auto'
        ? this.options.device
        : hasWebGPU
          ? 'webgpu'
          : 'wasm';

    const load = (device: string) => {
      // Each attempt reports its own aggregate; a retry on another backend
      // must not inherit the previous attempt's byte counts.
      this.fileBytes.clear();
      return pipeline('text-generation', this.options.model, {
        device: device as any,
        dtype: (this.options.dtype || 'q4') as any,
        progress_callback: this.onLoadProgress
          ? (event: any) => this.reportLoadProgress(event)
          : undefined
      });
    };

    try {
      this.generator = await load(requested);
    } catch (error) {
      if (requested === 'webgpu') {
        this.generator = await load('wasm');
      } else {
        throw new Error(
          `Failed to load Transformers.js model ${this.options.model}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }
  }

  /**
   * Translate a Transformers.js progress event into an aggregate percentage.
   *
   * The library reports per-file byte counts; summing them keeps the number
   * monotonic across the several files a model is made of, so a UI can show a
   * single download bar instead of one that restarts per shard.
   */
  private reportLoadProgress(event: any): void {
    if (!this.onLoadProgress) return;

    if (event?.status === 'ready') {
      this.onLoadProgress({ message: 'Local AI model ready', progress: 100 });
      return;
    }

    if (event?.status === 'progress' && typeof event.total === 'number' && event.total > 0) {
      this.fileBytes.set(event.file, {
        loaded: Math.min(event.loaded ?? 0, event.total),
        total: event.total
      });
    } else if (event?.status === 'done' && this.fileBytes.has(event.file)) {
      const entry = this.fileBytes.get(event.file)!;
      entry.loaded = entry.total;
    } else if (event?.status !== 'initiate' && event?.status !== 'download') {
      return;
    }

    let loaded = 0;
    let total = 0;
    for (const entry of this.fileBytes.values()) {
      loaded += entry.loaded;
      total += entry.total;
    }

    // Hold at 99 until 'ready' — the model still has to be compiled onto the
    // backend after the last byte arrives, and 100% that lingers reads as stuck.
    const progress = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
    this.onLoadProgress({
      message: 'Downloading local AI model',
      progress,
      file: event?.file
    });
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    if (!this.generator) {
      await this.initialize();
    }

    const signal = options?.signal;
    if (signal?.aborted) {
      throw new Error('Transformers.js generation aborted');
    }

    const systemPrompt = options?.systemPrompt || this.options.systemPrompt;
    const userContent = options?.context
      ? `Context:\n${options.context}\n\nQuestion: ${prompt}`
      : prompt;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    const generationOptions: Record<string, unknown> = {
      max_new_tokens: options?.maxTokens || this.options.maxTokens,
      do_sample: this.options.doSample,
      repetition_penalty: this.options.repetitionPenalty
    };

    if (this.options.doSample) {
      generationOptions.temperature = options?.temperature ?? this.options.temperature;
      generationOptions.top_k = this.options.topK;
      generationOptions.top_p = this.options.topP;
    }

    if (options?.onToken && this.streamerCtor) {
      generationOptions.streamer = new this.streamerCtor(this.generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text: string) => {
          if (signal?.aborted) return;
          options.onToken!(text);
        }
      });
    }

    // Interrupt the decode loop itself on abort — without this the model
    // would keep generating to max_new_tokens after the caller gave up.
    let onAbort: (() => void) | undefined;
    if (signal && this.stoppingCriteriaCtor) {
      const stopper = new this.stoppingCriteriaCtor();
      generationOptions.stopping_criteria = stopper;
      onAbort = () => stopper.interrupt();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    let result: any;
    try {
      result = await this.generator(messages, generationOptions);
    } finally {
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    }

    if (signal?.aborted) {
      throw new Error('Transformers.js generation aborted');
    }

    // Chat pipelines return the conversation with the assistant reply appended
    const generated = result?.[0]?.generated_text;
    if (Array.isArray(generated)) {
      const last = generated[generated.length - 1];
      return (last?.content ?? '').trim();
    }
    if (typeof generated === 'string') {
      return generated.trim();
    }
    throw new Error('Transformers.js returned an unexpected generation result');
  }

  async cleanup(): Promise<void> {
    await this.disposeGenerator();
  }

  private async disposeGenerator(): Promise<void> {
    const generator = this.generator;
    this.generator = null;
    if (generator && typeof generator.dispose === 'function') {
      try {
        await generator.dispose();
      } catch {
        // best-effort disposal
      }
    }
  }
}
