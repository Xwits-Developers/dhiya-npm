/**
 * LLM Manager - Orchestrates multiple LLM providers
 */

import { ILLMProvider, LLMGenerateOptions, LLMLoadProgressCallback } from './base.js';
import { ChromeAIProvider } from './chrome-ai-provider.js';
import { ChromeSummarizerProvider } from './chrome-summarizer-provider.js';
import { TransformersProvider } from './transformers-provider.js';
import { ChromeAIOptions, LLMProvider, LLMStatus, TransformersOptions } from '../core/types.js';
import { DEFAULT_CHROME_AI_OPTIONS, DEFAULT_TRANSFORMERS_OPTIONS, LLM_TIMEOUTS } from './config.js';

export interface LLMManagerOptions {
  preferredProvider?: LLMProvider;
  chromeAIOptions?: Partial<ChromeAIOptions>;
  transformersOptions?: Partial<TransformersOptions>;
  fallbackOrder?: LLMProvider[];
  /** Called while a provider downloads/compiles its model (Transformers.js only). */
  onLoadProgress?: LLMLoadProgressCallback;
}

export class LLMManager {
  private providers: Map<LLMProvider, ILLMProvider> = new Map();
  private activeProvider: LLMProvider | null = null;
  private preferredProvider: LLMProvider;
  private chromeAIOptions: ChromeAIOptions;
  private transformersOptions: TransformersOptions;
  private fallbackOrder: LLMProvider[];
  private onLoadProgress?: LLMLoadProgressCallback;
  /** Providers that failed to initialize; not re-probed until reset. */
  private failedProviders: Set<LLMProvider> = new Set();
  /** True once every provider in the fallback order has been tried and failed. */
  private exhausted = false;

  private initPromise: Promise<void> | null = null;
  private isInitializing = false;
  private debug: boolean;

  private static readonly REGISTERED_PROVIDERS: LLMProvider[] = [
    LLMProvider.CHROME_AI,
    LLMProvider.CHROME_SUMMARIZER,
    LLMProvider.TRANSFORMERS
  ];

  constructor(options: LLMProvider | (LLMManagerOptions & { debug?: boolean }) = LLMProvider.CHROME_AI) {
    if (typeof options === 'string') {
      this.preferredProvider = options;
      this.chromeAIOptions = { ...DEFAULT_CHROME_AI_OPTIONS };
      this.transformersOptions = { ...DEFAULT_TRANSFORMERS_OPTIONS };
      this.fallbackOrder = this.buildFallbackOrder();
      this.debug = false;
    } else {
      this.preferredProvider = options.preferredProvider ?? LLMProvider.CHROME_AI;
      this.chromeAIOptions = { ...DEFAULT_CHROME_AI_OPTIONS, ...(options.chromeAIOptions || {}) };
      this.transformersOptions = {
        ...DEFAULT_TRANSFORMERS_OPTIONS,
        ...(options.transformersOptions || {})
      };
      this.fallbackOrder = this.buildFallbackOrder(options.fallbackOrder);
      this.debug = options.debug ?? false;
      this.onLoadProgress = options.onLoadProgress;
    }

    if (!this.fallbackOrder.length) {
      this.preferredProvider = LLMProvider.NONE;
    } else if (
      this.preferredProvider === LLMProvider.NONE ||
      !this.fallbackOrder.includes(this.preferredProvider)
    ) {
      this.preferredProvider = this.fallbackOrder[0];
    }

    this.providers.set(LLMProvider.CHROME_AI, new ChromeAIProvider(this.chromeAIOptions));
    this.providers.set(LLMProvider.CHROME_SUMMARIZER, new ChromeSummarizerProvider());
    this.providers.set(
      LLMProvider.TRANSFORMERS,
      new TransformersProvider(this.transformersOptions, this.onLoadProgress)
    );
  }

  /**
   * Initialize LLM (tries preferred, falls back to alternatives).
   * A provider that fails is remembered and not re-probed on later calls.
   */
  async initialize(): Promise<void> {
    if (this.activeProvider || this.exhausted) return;

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
      if (this.failedProviders.has(providerType)) continue;
      if (await this._tryProvider(providerType)) {
        return;
      }
      this.failedProviders.add(providerType);
    }

    this.exhausted = true;
    if (this.debug) {
      console.warn('No LLM provider available, continuing with RAG-only mode');
    }
  }

  private async _tryProvider(providerType: LLMProvider): Promise<boolean> {
    const provider = this.providers.get(providerType);
    if (!provider) return false;

    try {
      const available = await provider.isAvailable();
      if (!available) {
        if (this.debug) console.log(`${providerType} not available`);
        return false;
      }

      await this._withTimeout(
        provider.initialize(),
        LLM_TIMEOUTS.initialize,
        `${providerType} initialization timed out`
      );
      this.activeProvider = providerType;
      if (this.debug) console.log(`LLM initialized with ${providerType}`);
      return true;
    } catch (error) {
      if (this.debug) console.warn(`Failed to initialize ${providerType}:`, error);
      return false;
    }
  }

  /**
   * Generate text with the active provider.
   *
   * A caller abort and the timeout both fire one internal AbortSignal that
   * is handed to the provider, so generation is genuinely interrupted (not
   * merely abandoned) when either happens.
   */
  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    if (options?.signal?.aborted) {
      throw new Error('LLM generation aborted');
    }

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

    const timeout = options?.timeout || this._getDefaultTimeout();
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    options?.signal?.addEventListener('abort', onCallerAbort, { once: true });

    const timer = setTimeout(() => controller.abort(), timeout);

    // Rejects when the internal signal fires, with a message that reflects
    // WHY it fired (caller abort vs deadline).
    const interruption = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        'abort',
        () => {
          reject(
            new Error(
              options?.signal?.aborted
                ? 'LLM generation aborted'
                : `LLM generation timed out after ${timeout}ms`
            )
          );
        },
        { once: true }
      );
    });

    try {
      return await Promise.race([
        provider.generate(prompt, { ...options, signal: controller.signal }),
        interruption
      ]);
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener('abort', onCallerAbort);
      // Settle the interruption promise's rejection silently if it lost the race
      interruption.catch(() => undefined);
    }
  }

  isAvailable(): boolean {
    return this.activeProvider !== null;
  }

  getActiveProvider(): LLMProvider | null {
    return this.activeProvider;
  }

  getStatus(): LLMStatus {
    return {
      available: this.activeProvider !== null,
      provider: this.activeProvider,
      loading: this.isInitializing
    };
  }

  async cleanup(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.cleanup();
      } catch (error) {
        if (this.debug) console.error('Provider cleanup error:', error);
      }
    }
    this.activeProvider = null;
    this.failedProviders.clear();
    this.exhausted = false;
  }

  setPreferredProvider(provider: LLMProvider): void {
    this.preferredProvider = provider;
    this.fallbackOrder = this.buildFallbackOrder([provider, ...this.fallbackOrder]);
    this.resetProbeState();
  }

  setFallbackOrder(order: LLMProvider[]): void {
    this.fallbackOrder = this.buildFallbackOrder(order);
    if (!this.fallbackOrder.length) {
      this.preferredProvider = LLMProvider.NONE;
    } else if (!this.fallbackOrder.includes(this.preferredProvider)) {
      this.preferredProvider = this.fallbackOrder[0];
    }
    this.resetProbeState();
  }

  updateTransformersOptions(options: Partial<TransformersOptions>): void {
    this.transformersOptions = { ...this.transformersOptions, ...options };
    const provider = this.providers.get(LLMProvider.TRANSFORMERS);
    if (provider instanceof TransformersProvider) {
      provider.setOptions(this.transformersOptions);
    }
    this.resetProbeState();
  }

  updateChromeAIOptions(options: Partial<ChromeAIOptions>): void {
    this.chromeAIOptions = { ...this.chromeAIOptions, ...options };
    const provider = this.providers.get(LLMProvider.CHROME_AI);
    if (provider instanceof ChromeAIProvider) {
      provider.setOptions(this.chromeAIOptions);
    }
    this.resetProbeState();
  }

  private resetProbeState(): void {
    this.activeProvider = null;
    this.failedProviders.clear();
    this.exhausted = false;
  }

  private async _withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }

  private _getDefaultTimeout(): number {
    switch (this.activeProvider) {
      case LLMProvider.CHROME_AI:
      case LLMProvider.CHROME_SUMMARIZER:
        return LLM_TIMEOUTS.chromeAI;
      case LLMProvider.TRANSFORMERS:
        return LLM_TIMEOUTS.transformers;
      default:
        return LLM_TIMEOUTS.chromeAI;
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
