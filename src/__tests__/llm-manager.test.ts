/**
 * LLM manager tests: provider fallback, failed-provider memory, and the
 * Chrome provider's targeting of the shipped LanguageModel API.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMManager } from '../llm/llm-manager';
import { ChromeAIProvider } from '../llm/chrome-ai-provider';
import { LLMProvider } from '../core/types';

const pipelineMock = vi.fn();

vi.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { allowLocalModels: false, useBrowserCache: false },
  TextStreamer: class {
    constructor(_tokenizer: unknown, _opts: unknown) {}
  }
}));

function installLanguageModelMock(availability = 'available') {
  const promptFn = vi.fn(async () => 'chrome answer');
  const createFn = vi.fn(async () => ({
    prompt: promptFn,
    promptStreaming: () => {
      throw new Error('not used in this test');
    },
    destroy: vi.fn()
  }));
  (globalThis as any).LanguageModel = {
    availability: vi.fn(async () => availability),
    create: createFn
  };
  return { promptFn, createFn };
}

function makeTextGenerator(reply: string) {
  return async (messages: Array<{ role: string; content: string }>) => [
    { generated_text: [...messages, { role: 'assistant', content: reply }] }
  ];
}

function installSummarizerMock(availability = 'available') {
  const summarizeFn = vi.fn(async () => 'summarized answer');
  const createFn = vi.fn(async () => ({
    summarize: summarizeFn,
    summarizeStreaming: () => {
      throw new Error('not used in this test');
    },
    destroy: vi.fn()
  }));
  (globalThis as any).Summarizer = {
    availability: vi.fn(async () => availability),
    create: createFn
  };
  return { summarizeFn, createFn };
}

describe('ChromeAIProvider (LanguageModel API)', () => {
  afterEach(() => {
    delete (globalThis as any).LanguageModel;
  });

  it('is unavailable when the LanguageModel global is missing', async () => {
    const provider = new ChromeAIProvider();
    expect(await provider.isAvailable()).toBe(false);
  });

  it('is unavailable while the model is still downloadable (needs user gesture)', async () => {
    installLanguageModelMock('downloadable');
    const provider = new ChromeAIProvider();
    expect(await provider.isAvailable()).toBe(false);
    await expect(provider.initialize()).rejects.toThrow(/not ready/);
  });

  it('is available and generates when LanguageModel is present', async () => {
    const { createFn } = installLanguageModelMock();
    const provider = new ChromeAIProvider();

    expect(await provider.isAvailable()).toBe(true);
    const text = await provider.generate('What is X?', { context: 'X is a thing.' });
    expect(text).toBe('chrome answer');
    expect(createFn).toHaveBeenCalled();
  });

  it('creates a fresh session per query so context never accumulates', async () => {
    const { createFn } = installLanguageModelMock();
    const provider = new ChromeAIProvider();
    await provider.generate('q1');
    await provider.generate('q2');
    // initialize() probe + one session per generate
    expect(createFn.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe('LLMManager', () => {
  beforeEach(() => {
    pipelineMock.mockReset();
    delete (globalThis as any).LanguageModel;
    delete (globalThis as any).Summarizer;
  });

  afterEach(() => {
    delete (globalThis as any).LanguageModel;
    delete (globalThis as any).Summarizer;
  });

  it('falls back to the Summarizer API before Transformers.js', async () => {
    // Prompt API absent, Summarizer available (the stable-Chrome web reality)
    installSummarizerMock('available');
    pipelineMock.mockResolvedValue(makeTextGenerator('should not be used'));

    const manager = new LLMManager({});
    await manager.initialize();

    expect(manager.getActiveProvider()).toBe(LLMProvider.CHROME_SUMMARIZER);
    const answer = await manager.generate('prompt', {
      context: 'The warranty lasts two years.',
      query: 'How long is the warranty?'
    });
    expect(answer).toBe('summarized answer');
    expect(pipelineMock).not.toHaveBeenCalled();
  });

  it('skips the Summarizer while its model is only downloadable', async () => {
    installSummarizerMock('downloadable');
    pipelineMock.mockResolvedValue(makeTextGenerator('transformers answer'));

    const manager = new LLMManager({});
    await manager.initialize();

    expect(manager.getActiveProvider()).toBe(LLMProvider.TRANSFORMERS);
  });

  it('falls back to Transformers.js when Chrome AI is unavailable', async () => {
    pipelineMock.mockResolvedValue(makeTextGenerator('transformers answer'));

    const manager = new LLMManager({
      preferredProvider: LLMProvider.CHROME_AI,
      fallbackOrder: [LLMProvider.CHROME_AI, LLMProvider.TRANSFORMERS]
    });

    await manager.initialize();
    expect(manager.getActiveProvider()).toBe(LLMProvider.TRANSFORMERS);

    const answer = await manager.generate('question', { context: 'ctx' });
    expect(answer).toBe('transformers answer');
  });

  it('prefers Chrome AI when the LanguageModel global exists', async () => {
    installLanguageModelMock();

    const manager = new LLMManager({
      preferredProvider: LLMProvider.CHROME_AI,
      fallbackOrder: [LLMProvider.CHROME_AI, LLMProvider.TRANSFORMERS]
    });

    await manager.initialize();
    expect(manager.getActiveProvider()).toBe(LLMProvider.CHROME_AI);
    expect(await manager.generate('hello')).toBe('chrome answer');
  });

  it('regression: failed providers are not re-probed on every generate', async () => {
    pipelineMock.mockRejectedValue(new Error('model download failed'));

    const manager = new LLMManager({
      fallbackOrder: [LLMProvider.TRANSFORMERS]
    });

    await manager.initialize();
    expect(manager.isAvailable()).toBe(false);
    const callsAfterInit = pipelineMock.mock.calls.length;

    await expect(manager.generate('q1')).rejects.toThrow(/No LLM provider available/);
    await expect(manager.generate('q2')).rejects.toThrow(/No LLM provider available/);

    // The failing model load must not be retried for every question
    expect(pipelineMock.mock.calls.length).toBe(callsAfterInit);
  });

  it('re-probes after options change', async () => {
    pipelineMock.mockRejectedValueOnce(new Error('first load fails'));
    pipelineMock.mockResolvedValue(makeTextGenerator('recovered'));

    const manager = new LLMManager({ fallbackOrder: [LLMProvider.TRANSFORMERS] });
    await manager.initialize();
    expect(manager.isAvailable()).toBe(false);

    manager.updateTransformersOptions({ model: 'some/other-model' });
    await manager.initialize();
    expect(manager.getActiveProvider()).toBe(LLMProvider.TRANSFORMERS);
    expect(await manager.generate('q')).toBe('recovered');
  });

  it('applies a generation timeout', async () => {
    pipelineMock.mockResolvedValue(
      () => new Promise(() => { /* never resolves */ })
    );

    const manager = new LLMManager({ fallbackOrder: [LLMProvider.TRANSFORMERS] });
    await manager.initialize();

    await expect(manager.generate('q', { timeout: 50 })).rejects.toThrow(/timed out/);
  });
});
