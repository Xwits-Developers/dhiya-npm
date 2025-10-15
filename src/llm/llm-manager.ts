/**
 * LLM Manager - Orchestrates multiple LLM providers
 */

import { ILLMProvider } from './base';
import { ChromeAIProvider } from './chrome-ai-provider';
import { TransformersProvider } from './transformers-provider';
import { ChromeAIOptions, LLMProvider, LLMStatus, TransformersOptions } from '../core/types';
import { DEFAULT_CHROME_AI_OPTIONS, DEFAULT_TRANSFORMERS_OPTIONS, LLM_TIMEOUTS } from './config';

export interface LLMManagerOptions {
  preferredProvider?: LLMProvider;
  chromeAIOptions?: Partial<ChromeAIOptions>;
  transformersOptions?: Partial<TransformersOptions>;
  fallbackOrder?: LLMProvider[];
}

export class LLMManager {
  private providers: Map<LLMProvider, ILLMProvider> = new Map();
  private activeProvider: LLMProvider | null = null;
  private preferredProvider: LLMProvider;
  private chromeAIOptions: ChromeAIOptions;
  private transformersOptions: TransformersOptions;
  private fallbackOrder: LLMProvider[];

  private initPromise: Promise<void> | null = null;
  private isInitializing = false;

  private static readonly REGISTERED_PROVIDERS: LLMProvider[] = [
    LLMProvider.CHROME_AI,
    LLMProvider.TRANSFORMERS
  ];

  constructor(options: LLMProvider | LLMManagerOptions = LLMProvider.CHROME_AI) {
    if (typeof options === 'string') {
      this.preferredProvider = options;
      this.chromeAIOptions = { ...DEFAULT_CHROME_AI_OPTIONS };
      this.transformersOptions = { ...DEFAULT_TRANSFORMERS_OPTIONS };
      this.fallbackOrder = this.buildFallbackOrder();
    } else {
      this.preferredProvider = options.preferredProvider ?? LLMProvider.CHROME_AI;
      this.chromeAIOptions = { ...DEFAULT_CHROME_AI_OPTIONS, ...(options.chromeAIOptions || {}) };
      this.transformersOptions = {
        ...DEFAULT_TRANSFORMERS_OPTIONS,
        ...(options.transformersOptions || {})
      };
      this.fallbackOrder = this.buildFallbackOrder(options.fallbackOrder);
    }

    if (!this.fallbackOrder.length) {
      this.preferredProvider = LLMProvider.NONE;
    } else if (
      this.preferredProvider === LLMProvider.NONE ||
      !this.fallbackOrder.includes(this.preferredProvider)
    ) {
      this.preferredProvider = this.fallbackOrder[0];
    }

    // Register providers with options
    this.providers.set(LLMProvider.CHROME_AI, new ChromeAIProvider(this.chromeAIOptions));
    this.providers.set(LLMProvider.TRANSFORMERS, new TransformersProvider(this.transformersOptions));
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
    for (const providerType of this.fallbackOrder) {
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

  setPreferredProvider(provider: LLMProvider): void {
    this.preferredProvider = provider;
    this.fallbackOrder = this.buildFallbackOrder([provider, ...this.fallbackOrder]);
    this.activeProvider = null;
  }

  setFallbackOrder(order: LLMProvider[]): void {
    this.fallbackOrder = this.buildFallbackOrder(order);
    if (!this.fallbackOrder.length) {
      this.preferredProvider = LLMProvider.NONE;
    } else if (!this.fallbackOrder.includes(this.preferredProvider)) {
      this.preferredProvider = this.fallbackOrder[0];
    }
    this.activeProvider = null;
  }

  updateTransformersOptions(options: Partial<TransformersOptions>): void {
    this.transformersOptions = { ...this.transformersOptions, ...options };
    const provider = this.providers.get(LLMProvider.TRANSFORMERS);
    if (provider instanceof TransformersProvider) {
      provider.setOptions(this.transformersOptions);
    }
    if (this.activeProvider === LLMProvider.TRANSFORMERS) {
      this.activeProvider = null;
    }
  }

  updateChromeAIOptions(options: Partial<ChromeAIOptions>): void {
    this.chromeAIOptions = { ...this.chromeAIOptions, ...options };
    const provider = this.providers.get(LLMProvider.CHROME_AI);
    if (provider instanceof ChromeAIProvider) {
      provider.setOptions(this.chromeAIOptions);
    }
    if (this.activeProvider === LLMProvider.CHROME_AI) {
      this.activeProvider = null;
    }
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

  private buildFallbackOrder(custom?: LLMProvider[]): LLMProvider[] {
    const base = custom?.length
      ? custom
      : [
          this.preferredProvider,
          ...LLMManager.REGISTERED_PROVIDERS.filter(p => p !== this.preferredProvider)
        ];

    const seen = new Set<LLMProvider>();
    const result: LLMProvider[] = [];

    for (const provider of base) {
      if (provider === LLMProvider.NONE) continue;
      if (!LLMManager.REGISTERED_PROVIDERS.includes(provider)) continue;
      if (seen.has(provider)) continue;
      seen.add(provider);
      result.push(provider);
    }

    return result;
  }
}

// Singleton instance (optional)
let llmManagerInstance: LLMManager | null = null;

export function getLLMManager(options?: LLMProvider | LLMManagerOptions): LLMManager {
  if (!llmManagerInstance) {
    llmManagerInstance = new LLMManager(options);
  }
  return llmManagerInstance;
}
