/**
 * LLM Provider interface and base types
 */

import { LLMProvider, LLMGenerateOptions } from '../core/types.js';

export type { LLMGenerateOptions };

export interface ILLMProvider {
  name: LLMProvider;
  isAvailable(): Promise<boolean>;
  initialize(): Promise<void>;
  generate(prompt: string, options?: LLMGenerateOptions): Promise<string>;
  cleanup(): Promise<void>;
}
