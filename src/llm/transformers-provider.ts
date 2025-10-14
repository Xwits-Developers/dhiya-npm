/**
 * Transformers.js Provider using DistilGPT-2
 * Runs locally in browser via WebGPU/WASM
 */

import { ILLMProvider, LLMGenerateOptions } from './base';
import { LLMProvider } from '../core/types';
import { TRANSFORMERS_CONFIG, GENERATION_CONFIG } from './config';

export class TransformersProvider implements ILLMProvider {
  name = LLMProvider.TRANSFORMERS;
  private generator: any = null;
  private isLoading = false;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined') return false;

      // Check for WebGPU or WASM support
      const hasWebGPU = 'gpu' in navigator;
      const hasWASM = typeof WebAssembly !== 'undefined';

      return hasWebGPU || hasWASM;
    } catch (error) {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    if (this.isLoading && this.loadPromise) {
      await this.loadPromise;
      return;
    }

    this.isLoading = true;
    this.loadPromise = this._loadModel();

    try {
      await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async _loadModel(): Promise<void> {
    console.log('📥 Loading Transformers.js model (DistilGPT-2)...');

    try {
      // Dynamic import to avoid bundling
      const { pipeline, env } = await import('@xenova/transformers');

      // Configure environment
      env.allowLocalModels = TRANSFORMERS_CONFIG.allowLocalModels;
      env.useBrowserCache = TRANSFORMERS_CONFIG.useBrowserCache;

      // Reduce ONNX runtime verbosity
      try {
        const backends: any = (env as any).backends;
        if (backends?.onnx) {
          backends.onnx.logLevel = 'error';
        }
      } catch { /* no-op */ }

      // Detect best device
      const hasWebGPU = 'gpu' in navigator;
      const device = hasWebGPU ? 'webgpu' : 'wasm';
      console.log(`🖥️  Using device: ${device}`);

      // Load model
      this.generator = await pipeline(
        'text-generation',
        TRANSFORMERS_CONFIG.model,
        {
          quantized: true
          // Note: device selection handled automatically by transformers.js
        }
      );

      this.isLoaded = true;
      console.log('✅ Transformers.js (DistilGPT-2) loaded successfully');
    } catch (error) {
      this.isLoaded = false;
      throw new Error(`Failed to load Transformers.js: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    if (!this.isLoaded) {
      await this.initialize();
    }

    try {
      const systemPrompt = options?.systemPrompt || TRANSFORMERS_CONFIG.systemPrompt;

      // Format prompt for GPT-2 (no chat template)
      const fullPrompt = options?.context
        ? `${systemPrompt}\n\nContext: ${options.context}\n\nQuestion: ${prompt}\n\nAnswer:`
        : `${systemPrompt}\n\nQuestion: ${prompt}\n\nAnswer:`;

      // Generate
      const result = await this.generator(fullPrompt, {
        max_new_tokens: options?.maxTokens || GENERATION_CONFIG.maxTokens,
        temperature: options?.temperature || GENERATION_CONFIG.temperature,
        top_k: GENERATION_CONFIG.topK,
        top_p: GENERATION_CONFIG.topP,
        repetition_penalty: GENERATION_CONFIG.repetitionPenalty,
        do_sample: GENERATION_CONFIG.doSample
      });

      // Extract generated text
      let generatedText = result[0].generated_text;

      // Remove the prompt from the response
      generatedText = generatedText.replace(fullPrompt, '').trim();

      // Clean up common artifacts
      generatedText = this.cleanResponse(generatedText);

      return generatedText;
    } catch (error) {
      throw new Error(`Transformers.js generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private cleanResponse(text: string): string {
    // Remove incomplete sentences at the end
    const sentences = text.split(/[.!?]+/);
    if (sentences.length > 1 && sentences[sentences.length - 1].trim().length < 20) {
      sentences.pop();
      text = sentences.join('. ') + '.';
    }

    // Remove repetitive patterns
    const lines = text.split('\n');
    const uniqueLines = [...new Set(lines)];
    if (uniqueLines.length < lines.length / 2) {
      text = uniqueLines.join('\n');
    }

    return text.trim();
  }

  async cleanup(): Promise<void> {
    this.generator = null;
    this.isLoaded = false;
    console.log('🧹 Transformers.js cleaned up');
  }
}
