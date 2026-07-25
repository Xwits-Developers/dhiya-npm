# 🧠 Dhiya

> A **client-side RAG chatbot** for the browser. Embeddings, vector search, storage, and answer generation all run locally — no servers, no API keys, and user data never leaves the device.

[![npm version](https://img.shields.io/npm/v/dhiya-npm.svg?style=flat-square)](https://www.npmjs.com/package/dhiya-npm)
[![npm downloads](https://img.shields.io/npm/dm/dhiya-npm.svg?style=flat-square)](https://www.npmjs.com/package/dhiya-npm)
[![types](https://img.shields.io/badge/Types-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

```bash
npm install dhiya-npm
```

## How it works

1. **Ingest** — your text/JSON/URL/markdown content is chunked on heading, paragraph, and sentence boundaries (markdown chunks carry their heading path).
2. **Embed** — chunks are embedded locally with [Transformers.js](https://github.com/huggingface/transformers.js) (`all-MiniLM-L6-v2`, ~25 MB one-time download, cached by the browser). WebGPU is used when available, WASM otherwise.
3. **Store** — chunks + vectors persist in IndexedDB, so the index survives reloads and works offline.
4. **Retrieve** — **hybrid search** blends vector similarity with BM25 keyword scoring, so both meaning-based matches and exact terms (codes, names, acronyms) rank well.
5. **Answer** — the top chunks are answered by a **local LLM grounded in the retrieved context**, with token streaming and abort support. Without an LLM, Dhiya falls back to extractive answers.

Three local answer providers, tried in order (all on-device — see [Chrome's built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis)):

| Provider | What it is | Where it works |
|----------|------------|----------------|
| `chrome-ai` | Gemini Nano via the [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) (`LanguageModel`) — best quality | Stable in Chrome **extensions** (138+); on regular web pages via origin trial. Used only when the model is already on the device. |
| `chrome-summarizer` | Gemini Nano via the [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api) — answers as question-focused summaries of the retrieved context | **Stable Chrome 138+ web pages.** No extra download when Nano is present. |
| `transformers` | An ONNX instruct model via Transformers.js (default `onnx-community/Qwen2.5-0.5B-Instruct`, ~350 MB q4, cached after first load) | Any modern browser (Chrome, Edge, Firefox, Safari); fastest with WebGPU |

Whichever is unavailable is skipped automatically, and if none can run Dhiya still answers extractively. Set `enableLLM: false` for the lightweight, extractive-only setup (~25 MB total).

## Quick start

```typescript
import { DhiyaClient } from 'dhiya-npm';

const client = new DhiyaClient();
await client.initialize();

await client.loadKnowledge({
  type: 'text',
  documentId: 'help',
  content: `Our warranty covers manufacturing defects for two years.

Refunds can be requested within 30 days of purchase.`
});

// Streaming answer
const answer = await client.ask('What does the warranty cover?', {
  onToken: t => process.stdout.write(t) // or append to your UI
});

console.log(answer.text);        // grounded answer
console.log(answer.sources);     // matched chunks with similarity scores
console.log(answer.confidence);  // 0..1
```

## Drop-in chat widget (no framework needed)

The `dhiya-npm/widget` entry registers a `<dhiya-chat>` custom element — a complete floating chat UI:

```html
<dhiya-chat title="Acme Help" accent="#0f766e" welcome="Hi! Ask me anything.">
  <script type="text/knowledge">
    Paste your docs, FAQ, or policies here.
  </script>
</dhiya-chat>

<script type="module">
  import 'https://cdn.jsdelivr.net/npm/dhiya-npm@2/dist/widget/index.js/+esm';
</script>
```

Widget attributes: `title`, `placeholder`, `welcome`, `accent` (CSS color), `position="left"`, `inline` (render in-place instead of floating), `kb-url` (fetch knowledge from a text/JSON URL), `db-name`, `no-llm`, `hide-sources`.

With a bundler, `import 'dhiya-npm/widget'` and either use attributes or hand the element a configured client: `document.querySelector('dhiya-chat').client = myClient`.

## React

`dhiya-npm/react` ships a `useRAG` hook that manages the client lifecycle and streams answers into a chat array (React is an optional peer dependency):

```tsx
import { useRAG } from 'dhiya-npm/react';

function Support() {
  const { ready, messages, send } = useRAG({
    knowledge: { type: 'text', content: 'Our warranty lasts two years. Refunds within 30 days.' }
  });

  const [q, setQ] = useState('');
  if (!ready) return <p>Loading…</p>;

  return (
    <div>
      {messages.map((m, i) => <p key={i}><b>{m.role}:</b> {m.content}</p>)}
      <form onSubmit={e => { e.preventDefault(); send(q); setQ(''); }}>
        <input value={q} onChange={e => setQ(e.target.value)} />
      </form>
    </div>
  );
}
```

`useRAG` returns `{ client, ready, loading, error, status, messages, ask, send, loadKnowledge, reset, refreshStatus }`. `send()` streams token-by-token into `messages`; `ask()` returns the full `Answer` without touching the chat history.

## API

| Method | Description |
|--------|-------------|
| `new DhiyaClient(config?)` | Create a client (see configuration below). |
| `initialize()` | Open storage and load the embedding model. Must be called first. Safe to call repeatedly. |
| `loadKnowledge(source)` | Ingest `{type:'text'|'json'|'url'|'array', ...}`. Re-loading the same `documentId` with changed content replaces it and invalidates cached answers. Unchanged content is skipped. |
| `ask(query, options?)` | Retrieval + grounded answer. Options: `topK`, `enableLLM`, `timeout`, `conversationHistory`, `onToken` (streaming), `skipCache`, `signal` (abort). |
| `search(query, options?)` | Raw scored chunks (`{chunk, similarity}[]`) without answer synthesis. |
| `getStatus()` | Embedding/LLM/storage/knowledge-base state — useful for loading UIs. |
| `removeDocument(docId)` | Remove one document and its chunks. |
| `clear()` | Wipe all knowledge and cached answers. |
| `destroy()` | Release models, close storage. |

### Key configuration

```typescript
const client = new DhiyaClient({
  // storage
  dbName: 'dhiya-kb',
  cacheTTL: 24 * 60 * 60 * 1000,   // answer cache lifetime
  // models
  embeddingModel: 'english',        // or 'multilingual' (50+ languages, ~120 MB)
  device: 'auto',                   // 'webgpu' | 'wasm' | 'auto'
  enableLLM: true,
  transformersModel: 'onnx-community/Qwen2.5-0.5B-Instruct',
  llmFallbackOrder: ['chrome-ai', 'chrome-summarizer', 'transformers'],
  // retrieval & answers
  chunkSize: 900,                   // paragraphs are the retrieval unit; this caps oversized ones
  markdownAware: true,              // split markdown on headings, carry heading path into chunks
  hybridSearch: true,               // blend BM25 keyword scoring with vectors
  keywordWeight: 0.4,               // 0 = pure vector, 1 = pure keyword
  topK: 5,
  similarityThreshold: 0.2,
  minLLMSimilarity: 0.25,           // below this, skip the LLM (avoids hallucination)
  noAnswerMessage: "I don't have enough information in my knowledge base to answer that.",
  singleAnswerMode: false,          // true = short focused snippet, no LLM
  // hooks
  debug: false,
  onProgress: e => console.log(e.message, e.progress)
});
```

`TRANSFORMERS_MODELS` exports a few known-good generation models with size/quality notes.

## Browser support

- **Chrome / Edge** — WebGPU embeddings + Chrome built-in AI (Summarizer on stable web pages; Prompt API in extensions/origin trial).
- **Firefox / Safari 16+** — WASM embeddings; LLM answers via Transformers.js.
- Requires IndexedDB, so Dhiya runs **in the browser only**. In SSR frameworks (Next.js etc.) create the client inside a client component / `useEffect`; importing the package on the server is safe (`initialize()` throws a clear error there).
- Model files are fetched from the Hugging Face Hub on first use and cached by the browser. For fully offline or air-gapped deployments, self-host the models and point Transformers.js at them via `transformersOptions`.

## Honest limitations

- The default 0.5B-parameter local model is small: grounded answers are good, but it is not GPT-4. Swap in a larger model (e.g. `onnx-community/Llama-3.2-1B-Instruct`) where hardware allows.
- First-time model downloads take bandwidth (~25 MB embeddings; ~350 MB default LLM). Use `enableLLM: false` or `no-llm` if that's too heavy for your users.
- Retrieval is exact cosine search over all chunks — great up to roughly 10k chunks, not built for millions.

## Examples

- [`examples/vite-demo`](examples/vite-demo) — full API walkthrough with streaming chat and the widget.
- [`examples/cdn.html`](examples/cdn.html) — zero-build script-tag integration.

## License

MIT — see [LICENSE](LICENSE).

## Author

Built by [Deep Parmar](https://deepap.dev) — AI engineer in Ahmedabad, India; CTO & co-founder of [Sunbots Innovations](https://www.sunbots.in/), founder of [Xwits](https://xwits.dev/), and creator of [SmartON](https://www.getsmartonai.com/), AI-powered smart glasses used by 17,000+ blind and visually-impaired users.

Read more about client-side RAG on the blog: [Client-Side RAG: Running AI in Your Browser](https://deepap.dev/blogs/client-side-rag-browser-ai) · [How to Build a RAG Chatbot with Dhiya NPM](https://deepap.dev/blogs/build-rag-chatbot-dhiya-npm)
