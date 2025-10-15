# 🧠 Dhiya NPM

> Production-ready **client-side RAG client** for the browser — privacy-first, WebGPU-ready, offline-capable vector search with LLM fallbacks.

[![npm version](https://img.shields.io/npm/v/dhiya-npm.svg?style=flat-square)](https://www.npmjs.com/package/dhiya-npm)
[![npm downloads](https://img.shields.io/npm/dm/dhiya-npm.svg?style=flat-square)](https://www.npmjs.com/package/dhiya-npm)
[![bundle size](https://img.shields.io/bundlephobia/minzip/dhiya-npm.svg?style=flat-square)](https://bundlephobia.com/package/dhiya-npm)
[![types](https://img.shields.io/badge/Types-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

```bash
npm install dhiya-npm
```

## ⚡ 30-Second “Hello RAG”

```typescript
import { DhiyaClient, LLMProvider } from 'dhiya-npm';

const client = new DhiyaClient({
  preferredProvider: LLMProvider.CHROME_AI,
  llmFallbackOrder: [LLMProvider.CHROME_AI, LLMProvider.TRANSFORMERS]
});

await client.initialize();

await client.loadKnowledge({
  type: 'array',
  documentId: 'docs',
  items: [
    'Dhiya is a client-side RAG framework that runs entirely in the browser.',
    'It ships WebGPU embeddings, offline vector search, and privacy-preserving LLM fallbacks.',
    'Use it to power documentation chatbots, support widgets, and secure intranet Q&A.'
  ]
});

const answer = await client.ask('What makes Dhiya a privacy-first RAG client?');
console.log(answer.text);
```

## 💡 Why Client-Side RAG?

- **Zero infrastructure** – ship a full RAG stack without servers or API keys.
- **Privacy & compliance** – sensitive content never leaves the device.
- **Offline RAG** – embeddings, index, and LLM fallbacks run without network.
- **Instant feedback loops** – ship demos or production widgets that update immediately.

## 🚀 Feature Highlights

- **Client-side RAG framework** with WebGPU embeddings, WebAssembly fallback, and IndexedDB persistence.
- **Browser RAG pipeline**: semantic chunking, vector search, and answer synthesis tuned for in-browser AI.
- **Local LLM control**: Chrome AI (Gemini Nano) prioritized, Transformers.js fallback with configurable models, prompts, and temperatures.
- **Offline vector store** with automatic cache eviction and chunk manifests for delta updates.
- **Privacy-first RAG** safeguards: strict RAG mode, similarity gating, chunk-count checks, context caps.
- **LangChain.js & WebLLM friendly** utilities that slot into existing workflows.

## 🧱 Architecture at a Glance

1. **Chunker** → Splits knowledge sources into retrieval-friendly segments.
2. **Embeddings (WebGPU / WASM)** → Generates vectors locally via Transformers.js.
3. **Vector Store (IndexedDB)** → Stores chunks + embeddings with TTL and manifest tracking.
4. **Retriever** → Performs WebAssembly-accelerated cosine similarity searches.
5. **Generator** → Optional LLM enhancer (Chrome AI → Transformers.js → RAG-only).
6. **Answer Formatter** → Adds citations, confidence, and timing metadata.

## 📚 API Reference

| Method | Description | Key Options |
|--------|-------------|-------------|
| `constructor(config?: DhiyaConfig)` | Create a client with defaults merged in. | Configure `client-side rag` levers such as `preferredProvider`, `transformersOptions`, `chromeAIOptions`, `strictRAG`. |
| `initialize()` | Loads storage, embeddings, cached chunks, and warms up LLMs asynchronously. | Emits progress callbacks via `onProgress`. |
| `loadKnowledge(source)` | Ingest JSON, text, URL, or string arrays. Automatically chunks, embeds, and stores vectors. | Supports incremental updates via document manifests. |
| `ask(query, options?)` | Runs retrieval, optionally enhances with LLM, and formats a privacy-preserving answer. | Control `topK`, `enableLLM`, `conversationHistory`, `timeout`. |
| `getStatus()` | Snapshot of embedding, storage, knowledge base, and LLM state. | Useful for dashboards and guardrails. |
| `clear()` | Removes all persisted chunks and manifests. | Keeps embeddings and configuration intact. |
| `destroy()` | Releases resources, closes storage, and cleans up LLM sessions. | Call on app teardown. |

Additional helpers are exported to integrate with LangChain.js retrievers, custom similarity scoring, and device capability checks.

## 🌐 Browser & GPU Support

- ✔️ Chrome / Edge (WebGPU + Chrome AI Gemini Nano)
- ✔️ Firefox (WASM embeddings + IndexedDB vector search)
- ✔️ Safari 15+ (WASM fallback, storage quotas handled internally)
- GPU acceleration automatically falls back to WASM or CPU; provide `device: 'webgpu' | 'wasm' | 'cpu'` for deterministic behaviour.

## 📊 Benchmarks _(MacBook Pro M2, Chrome 129)_

| Operation | WebGPU | WASM |
|-----------|--------|------|
| Initial embedding throughput | ~180 chunks/sec | ~45 chunks/sec |
| Query retrieval latency (top-5) | 18 ms avg | 42 ms avg |
| LLM enhancement (Chrome AI) | ≤ 2 s median | — |
| IndexedDB persistence | 1,200 chunks/sec write | 1,200 chunks/sec write |

Numbers are indicative; tune chunk size, overlap, and batching to match your domain.

## 🧪 Examples & Templates

- **Vite browser RAG** – `/example` (run `npm run example`) showcases live status indicators and a docs-focused chat UI.
- **React + Vite** – `/examples/react-vite` demonstrates a lightweight SPA that depends on `dhiya-npm`. Install and run with `npm install && npm run dev`.
- **Next.js App Router** – `/examples/nextjs-app` renders a client component that loads Dhiya in the browser. Start with `npm install && npm run dev`.
- **CDN / Vanilla JS demo** – embed in a static page with `<script type="module">`.

Feel free to add more dependents (SvelteKit, Astro, Electron). Every published example improves how “rag client” searches discover Dhiya.

## ☁️ CDN Usage (jsDelivr)

```html
<script type="module">
  import { DhiyaClient, LLMProvider } from 'https://cdn.jsdelivr.net/npm/dhiya-npm/dist/index.js';

  const client = new DhiyaClient({
    enableLLM: false, // Pure browser RAG without LLM
    device: 'auto'
  });

  await client.initialize();
  await client.loadKnowledge({
    type: 'text',
    documentId: 'policy',
    content: 'Our privacy-preserving RAG client keeps all data on device.'
  });

  const { text } = await client.ask('Summarize the policy in one sentence');
  console.log(text);
</script>
```

Use `unpkg` or pin versions with `@1.x` for stable builds.

## 🔗 Compatibility Notes

- Works alongside **LangChain.js** via custom retriever adapters using exported similarity helpers.
- Plays nicely with **WebLLM**, **Transformers.js**, and other local LLM runtimes — swap in your own generator when needed.
- Designed for “browser rag”, “offline rag”, and “privacy rag” workflows where sockets and servers are not an option.

## 🗺️ Roadmap & Contributing

- ✅ Current focus: better LangChain.js adapters, React hooks, and WASM-optimized reranking.
- 🧭 Upcoming: hybrid reranker, streaming answer mode, improved telemetry hooks, additional demo templates.

Want to help? Fork the repo, run `npm run build && npm test -- --run`, and open a pull request. Discussions and issues are tracked on GitHub.

## 📜 License

Dhiya is released under the [MIT License](LICENSE). Use it to build privacy-preserving, in-browser RAG applications with confidence.
