/**
 * LLM Provider interface and base types
 */

import { LLMProvider, LLMGenerateOptions } from '../core/types.js';

export type { LLMGenerateOptions };

/**
 * A snapshot of a provider's one-time model download/initialization.
 *
 * `progress` is an aggregate across every file the provider is fetching, so it
 * advances monotonically toward 100 rather than restarting per file.
 */
export interface LLMLoadProgress {
  /** Human-readable stage, e.g. 'Downloading local AI model'. */
  message: string;
  /** Overall completion across all files, 0-100. */
  progress: number;
  /** File currently being fetched, when the provider reports one. */
  file?: string;
}

export type LLMLoadProgressCallback = (event: LLMLoadProgress) => void;

export interface ILLMProvider {
  name: LLMProvider;
  isAvailable(): Promise<boolean>;
  initialize(): Promise<void>;
  generate(prompt: string, options?: LLMGenerateOptions): Promise<string>;
  cleanup(): Promise<void>;
}
