/**
 * Chrome Built-in AI Provider (Gemini Nano)
 * Documentation: https://developer.chrome.com/docs/ai/built-in
 */

import { ILLMProvider, LLMGenerateOptions } from './base';
import { ChromeAIOptions, LLMProvider } from '../core/types';
import { DEFAULT_CHROME_AI_OPTIONS } from './config';

// Chrome AI types
declare global {
  interface Window {
    ai?: {
      languageModel?: {
        capabilities(): Promise<{
          available: 'readily' | 'after-download' | 'no';
        }>;
        create(options?: {
          temperature?: number;
          topK?: number;
          initialPrompts?: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string;
          }>;
        }): Promise<{
          prompt(text: string): Promise<string>;
          destroy(): void;
        }>;
      };
    };
  }
}

export class ChromeAIProvider implements ILLMProvider {
  name = LLMProvider.CHROME_AI;
  private session: any = null;
  private options: ChromeAIOptions;

  constructor(options: ChromeAIOptions = DEFAULT_CHROME_AI_OPTIONS) {
    this.options = { ...options };
  }

  setOptions(options: Partial<ChromeAIOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;
      if (!window.ai?.languageModel) return false;

      const capabilities = await window.ai.languageModel.capabilities();
      return capabilities.available === 'readily' || capabilities.available === 'after-download';
    } catch (error) {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (this.session) return; // Already initialized

    if (typeof window === 'undefined' || !window.ai?.languageModel) {
      throw new Error('Chrome AI not available. Enable flags: chrome://flags/#prompt-api-for-gemini-nano');
    }

    try {
      const capabilities = await window.ai.languageModel.capabilities();

      if (capabilities.available === 'no') {
        throw new Error('Chrome AI not supported on this device');
      }

      if (capabilities.available === 'after-download') {
        console.warn('Chrome AI model needs to be downloaded. Visit chrome://components/');
      }

      // Create session
      this.session = await window.ai.languageModel.create({
        temperature: this.options.temperature,
        topK: this.options.topK,
        initialPrompts: [
          {
            role: 'system',
            content: this.options.systemPrompt
          }
        ]
      });

      console.log('✅ Chrome AI (Gemini Nano) initialized');
    } catch (error) {
      throw new Error(`Chrome AI initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    if (options?.systemPrompt && options.systemPrompt !== this.options.systemPrompt) {
      this.setOptions({ systemPrompt: options.systemPrompt });
    }

    if (!this.session) {
      await this.initialize();
    }

    try {
      // Add context if provided
      let fullPrompt = prompt;
      if (options?.context) {
        fullPrompt = `Context:\n${options.context}\n\nQuestion: ${prompt}`;
      }

      const response = await this.session.prompt(fullPrompt);
      return response.trim();
    } catch (error) {
      throw new Error(`Chrome AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.session) {
      this.session.destroy();
      this.session = null;
      console.log('🧹 Chrome AI session cleaned up');
    }
  }
}
