/**
 * LLM Manager - Orchestrates multiple LLM providers
 */

import { ILLMProvider } from './base';
import { ChromeAIProvider } from './chrome-ai-provider';
import { TransformersProvider } from './transformers-provider';
import { LLMProvider, LLMStatus } from '../core/types';
import { LLM_TIMEOUTS } from './config';

export class LLMManager {
  private providers: Map<LLMProvider, ILLMProvider> = new Map();
  private activeProvider: LLMProvider | null = null;
  private preferredProvider: LLMProvider;
  private initPromise: Promise<void> | null = null;
  private isInitializing = false;

  constructor(preferredProvider: LLMProvider = LLMProvider.CHROME_AI) {
    this.preferredProvider = preferredProvider;
    
    // Register providers
    this.providers.set(LLMProvider.CHROME_AI, new ChromeAIProvider());
    this.providers.set(LLMProvider.TRANSFORMERS, new TransformersProvider());
  }

  /**
   * Initialize LLM (tries preferred, falls back to alternatives)
   */
  async initialize(): Promise<void> {
    if (this.activeProvider) return; // Already initialized

    if (this.isInitializing && this.initPromise) {
      await this.initPromise;
      return;
    }

    this.isInitializing = true;
    this.initPromise = this._tryInitialize();

    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async _tryInitialize(): Promise<void> {
    // Try preferred provider first
    if (await this._tryProvider(this.preferredProvider)) {
      return;
    }

    // Try other providers
    const otherProviders = Array.from(this.providers.keys())
      .filter(p => p !== this.preferredProvider && p !== LLMProvider.NONE);

    for (const providerType of otherProviders) {
      if (await this._tryProvider(providerType)) {
        return;
      }
    }

    console.warn('⚠️  No LLM provider available, continuing with RAG-only mode');
  }

  private async _tryProvider(providerType: LLMProvider): Promise<boolean> {
    const provider = this.providers.get(providerType);
    if (!provider) return false;

    try {
      const available = await provider.isAvailable();
      if (!available) {
        console.log(`⏭️  ${providerType} not available`);
        return false;
      }

      await provider.initialize();
      this.activeProvider = providerType;
      console.log(`✅ LLM initialized with ${providerType}`);
      return true;
    } catch (error) {
      console.warn(`❌ Failed to initialize ${providerType}:`, error);
      return false;
    }
  }

  /**
   * Generate text with active provider
   */
  async generate(
    prompt: string,
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      context?: string;
      timeout?: number;
    }
  ): Promise<string> {
    if (!this.activeProvider) {
      await this.initialize();
    }

    if (!this.activeProvider) {
      throw new Error('No LLM provider available');
    }

    const provider = this.providers.get(this.activeProvider);
    if (!provider) {
      throw new Error(`Provider ${this.activeProvider} not found`);
    }

    // Apply timeout
    const timeout = options?.timeout || this._getDefaultTimeout();
    return this._withTimeout(
      provider.generate(prompt, options),
      timeout,
      `LLM generation timed out after ${timeout}ms`
    );
  }

  /**
   * Check if LLM is available
   */
  isAvailable(): boolean {
    return this.activeProvider !== null;
  }

  /**
   * Get active provider
   */
  getActiveProvider(): LLMProvider | null {
    return this.activeProvider;
  }

  /**
   * Get status
   */
  getStatus(): LLMStatus {
    return {
      available: this.activeProvider !== null,
      provider: this.activeProvider,
      loading: this.isInitializing
    };
  }

  /**
   * Cleanup all providers
   */
  async cleanup(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.cleanup();
      } catch (error) {
        console.error('Provider cleanup error:', error);
      }
    }
    this.activeProvider = null;
  }

  /**
   * Helper: Run promise with timeout
   */
  private async _withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle!);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle!);
      throw error;
    }
  }

  /**
   * Get default timeout based on active provider
   */
  private _getDefaultTimeout(): number {
    switch (this.activeProvider) {
      case LLMProvider.CHROME_AI:
        return LLM_TIMEOUTS.chromeAI;
      case LLMProvider.TRANSFORMERS:
        return LLM_TIMEOUTS.transformers;
      default:
        return LLM_TIMEOUTS.fallback;
    }
  }
}

// Singleton instance (optional)
let llmManagerInstance: LLMManager | null = null;

export function getLLMManager(preferredProvider?: LLMProvider): LLMManager {
  if (!llmManagerInstance) {
    llmManagerInstance = new LLMManager(preferredProvider);
  }
  return llmManagerInstance;
}
