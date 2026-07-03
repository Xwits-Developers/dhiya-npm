/**
 * Transformers.js Provider — runs an instruct model locally in the browser
 * via WebGPU (with WASM fallback) using @huggingface/transformers.
 */

import { ILLMProvider, LLMGenerateOptions } from './base.js';
import { LLMProvider, TransformersOptions } from '../core/types.js';
import { DEFAULT_TRANSFORMERS_OPTIONS } from './config.js';

export class TransformersProvider implements ILLMProvider {
  name = LLMProvider.TRANSFORMERS;
  private generator: any = null;
  private streamerCtor: any = null;
  private loadPromise: Promise<void> | null = null;
  private options: TransformersOptions;

  constructor(options: TransformersOptions = DEFAULT_TRANSFORMERS_OPTIONS) {
    this.options = { ...options };
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
    const { pipeline, env, TextStreamer } = await import('@huggingface/transformers');

    env.allowLocalModels = this.options.allowLocalModels;
    env.useBrowserCache = this.options.useBrowserCache;
    this.streamerCtor = TextStreamer;

    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const requested =
      this.options.device && this.options.device !== 'auto'
        ? this.options.device
        : hasWebGPU
          ? 'webgpu'
          : 'wasm';

    const load = (device: string) =>
      pipeline('text-generation', this.options.model, {
        device: device as any,
        dtype: (this.options.dtype || 'q4') as any
      });

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

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    if (!this.generator) {
      await this.initialize();
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
        callback_function: (text: string) => options.onToken!(text)
      });
    }

    const result = await this.generator(messages, generationOptions);

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
