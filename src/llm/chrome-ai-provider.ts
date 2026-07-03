/**
 * Chrome Built-in AI Provider (Gemini Nano) via the Prompt API.
 *
 * Targets the shipped API surface (Chrome 138+): a global `LanguageModel`
 * object with availability() / create() / prompt() / promptStreaming().
 * See https://developer.chrome.com/docs/ai/prompt-api
 */

import { ILLMProvider, LLMGenerateOptions } from './base.js';
import { ChromeAIOptions, LLMProvider } from '../core/types.js';
import { DEFAULT_CHROME_AI_OPTIONS } from './config.js';

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguageModelSession {
  prompt(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(text: string, options?: { signal?: AbortSignal }): ReadableStream<string>;
  destroy(): void;
}

interface LanguageModelStatic {
  availability(options?: Record<string, unknown>): Promise<Availability>;
  create(options?: {
    temperature?: number;
    topK?: number;
    initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    monitor?: (m: EventTarget) => void;
    signal?: AbortSignal;
  }): Promise<LanguageModelSession>;
}

function getLanguageModel(): LanguageModelStatic | undefined {
  return (globalThis as any).LanguageModel as LanguageModelStatic | undefined;
}

export class ChromeAIProvider implements ILLMProvider {
  name = LLMProvider.CHROME_AI;
  private options: ChromeAIOptions;
  private verified = false;

  constructor(options: ChromeAIOptions = DEFAULT_CHROME_AI_OPTIONS) {
    this.options = { ...options };
  }

  setOptions(options: Partial<ChromeAIOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Only reports true when the Gemini Nano model is already on disk.
   * When availability is 'downloadable'/'downloading', session creation
   * requires a user gesture (NotAllowedError otherwise), so a background
   * initialization cannot use the provider — fall through to the next one.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const lm = getLanguageModel();
      if (!lm) return false;

      const availability = await lm.availability();
      return availability === 'available';
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    const lm = getLanguageModel();
    if (!lm) {
      throw new Error(
        'Chrome built-in AI is not available in this browser. It requires Chrome 138+ on supported hardware.'
      );
    }

    const availability = await lm.availability();
    if (availability !== 'available') {
      throw new Error(
        `Chrome built-in AI model is not ready (availability: ${availability}). ` +
        'The model must be downloaded before Dhiya can use it.'
      );
    }

    // Verify a session can be created, then release it. Per-query sessions
    // are created in generate() so context never accumulates across
    // unrelated questions.
    const session = await lm.create(this.createOptions());
    session.destroy();
    this.verified = true;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    const signal = options?.signal;
    if (signal?.aborted) {
      throw new Error('Chrome AI generation aborted');
    }

    const lm = getLanguageModel();
    if (!lm) {
      throw new Error('Chrome built-in AI not available');
    }

    if (!this.verified) {
      await this.initialize();
    }

    const systemPrompt = options?.systemPrompt || this.options.systemPrompt;
    const session = await lm.create({
      ...this.createOptions(systemPrompt),
      ...(signal ? { signal } : {})
    });

    try {
      const fullPrompt = options?.context
        ? `Context:\n${options.context}\n\nQuestion: ${prompt}`
        : prompt;

      if (options?.onToken) {
        const stream = session.promptStreaming(fullPrompt, signal ? { signal } : undefined);
        const reader = stream.getReader();
        let text = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (signal?.aborted) {
            await reader.cancel();
            throw new Error('Chrome AI generation aborted');
          }
          text += value;
          options.onToken(value);
        }
        return text.trim();
      }

      const response = await session.prompt(fullPrompt, signal ? { signal } : undefined);
      return response.trim();
    } finally {
      session.destroy();
    }
  }

  async cleanup(): Promise<void> {
    this.verified = false;
  }

  private createOptions(systemPrompt?: string) {
    const sp = systemPrompt || this.options.systemPrompt;
    return {
      ...(this.options.temperature !== undefined ? { temperature: this.options.temperature } : {}),
      ...(this.options.topK !== undefined ? { topK: this.options.topK } : {}),
      initialPrompts: sp ? [{ role: 'system' as const, content: sp }] : []
    };
  }
}
