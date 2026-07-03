/**
 * Chrome Built-in AI Summarizer provider.
 *
 * The Summarizer API is available in stable Chrome (138+) on regular web
 * pages — unlike the Prompt API, which is extensions-only in stable — and
 * runs on the same on-device Gemini Nano foundation model.
 * See https://developer.chrome.com/docs/ai/summarizer-api
 *
 * Strategy: RAG answering as focused summarization. The retrieved context is
 * summarized with the user's question supplied as the summarization context,
 * which yields grounded, on-device answers with no extra model download when
 * Gemini Nano is already present.
 */

import { ILLMProvider, LLMGenerateOptions } from './base.js';
import { LLMProvider } from '../core/types.js';

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface SummarizerSession {
  summarize(text: string, options?: { context?: string; signal?: AbortSignal }): Promise<string>;
  summarizeStreaming(text: string, options?: { context?: string; signal?: AbortSignal }): ReadableStream<string>;
  destroy(): void;
}

interface SummarizerStatic {
  availability(): Promise<Availability>;
  create(options?: {
    type?: 'tldr' | 'tl;dr' | 'key-points' | 'teaser' | 'headline';
    format?: 'plain-text' | 'markdown';
    length?: 'short' | 'medium' | 'long';
    sharedContext?: string;
    monitor?: (m: EventTarget) => void;
    signal?: AbortSignal;
  }): Promise<SummarizerSession>;
}

function getSummarizer(): SummarizerStatic | undefined {
  return (globalThis as any).Summarizer as SummarizerStatic | undefined;
}

export class ChromeSummarizerProvider implements ILLMProvider {
  name = LLMProvider.CHROME_SUMMARIZER;
  private verified = false;

  /**
   * Only reports true when the on-device model is already available —
   * downloads require a user gesture and cannot run from a background
   * initialization (same policy as the Prompt API provider).
   */
  async isAvailable(): Promise<boolean> {
    try {
      const summarizer = getSummarizer();
      if (!summarizer) return false;
      return (await summarizer.availability()) === 'available';
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    const summarizer = getSummarizer();
    if (!summarizer) {
      throw new Error('Chrome Summarizer API is not available in this browser (requires Chrome 138+).');
    }

    const availability = await summarizer.availability();
    if (availability !== 'available') {
      throw new Error(
        `Chrome Summarizer model is not ready (availability: ${availability}).`
      );
    }

    const session = await summarizer.create({ type: 'tldr', format: 'plain-text', length: 'medium' });
    session.destroy();
    this.verified = true;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    const summarizerStatic = getSummarizer();
    if (!summarizerStatic) {
      throw new Error('Chrome Summarizer API not available');
    }

    if (!this.verified) {
      await this.initialize();
    }

    // Summarization needs the raw retrieved context; the question rides along
    // as summarization context so the output stays focused on it.
    const material = options?.context || prompt;
    const question = options?.query;

    const session = await summarizerStatic.create({
      type: 'tldr',
      format: 'plain-text',
      length: 'medium',
      sharedContext: question
        ? `The reader asked: "${question}". Only include information that answers this question.`
        : undefined
    });

    try {
      const contextOption = question
        ? { context: `Answer the question: "${question}". Ignore unrelated content.` }
        : undefined;

      if (options?.onToken) {
        const stream = session.summarizeStreaming(material, contextOption);
        const reader = stream.getReader();
        let text = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += value;
          options.onToken(value);
        }
        return text.trim();
      }

      const summary = await session.summarize(material, contextOption);
      return summary.trim();
    } finally {
      session.destroy();
    }
  }

  async cleanup(): Promise<void> {
    this.verified = false;
  }
}
