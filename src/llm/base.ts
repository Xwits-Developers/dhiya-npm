/**
 * LLM Provider interface and base types
 */

import { LLMProvider } from '../core/types';

export interface ILLMProvider {
  name: LLMProvider;
  isAvailable(): Promise<boolean>;
  initialize(): Promise<void>;
  generate(prompt: string, options?: LLMGenerateOptions): Promise<string>;
  cleanup(): Promise<void>;
}

export interface LLMGenerateOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  context?: string;
  timeout?: number;
}
