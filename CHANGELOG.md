# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-07-03

Quality and integration release — better retrieval, first-class React support,
and structure-aware ingestion. Fully backward compatible with 2.0.

### Added
- **Hybrid retrieval (keyword + vector).** Vector similarity is now blended
  with a BM25 keyword score over the same chunks, so exact terms — product
  codes, names, acronyms, error strings — that pure embeddings miss are
  reliably retrieved. On by default; tune with `hybridSearch` and
  `keywordWeight` (0..1, default 0.4), or set `hybridSearch: false` for
  pure-vector behavior.
- **React hook — `dhiya-npm/react`.** `useRAG(config)` owns a client's
  lifecycle (StrictMode-safe), exposes `ready` / `loading` / `error` /
  `status`, a streaming `send()` that builds a chat `messages` array, plus
  `ask()`, `loadKnowledge()`, and `reset()`. `react` is an optional peer
  dependency, so non-React users are unaffected.
- **Markdown-aware chunking.** Markdown is split on headings and each chunk
  carries its heading path (e.g. `Billing > Refunds`), keeping section context
  with every piece and boosting both keyword and vector relevance. Auto-detected;
  toggle with `markdownAware`.
- **Abort support.** `ask(query, { signal })` cancels in-flight LLM generation
  via an `AbortSignal` (native cancellation on the Chrome providers), returning
  the extractive answer instead.

### Changed
- Default `similarityThreshold` lowered to 0.2 and `minLLMSimilarity` to 0.25
  to match the recalibrated hybrid score distribution.
- `search(query)` and `ask(query)` now feed the query text into the keyword
  index automatically (no API change).

### Hardening (from adversarial review of the new code)
- `similarityThreshold` remains a **pure-cosine floor**: keyword evidence is a
  saturating *boost* toward 1 (never a penalty), so hybrid can only improve on
  pure-vector ranking; a chunk below the floor is admitted only on strong
  lexical evidence with non-negative cosine — keyword noise cannot leak in.
- BM25 scores are no longer stretched to 1.0 per query (weak best-matches
  stay weak); single-character identifiers ("C", vitamin "B") are indexed.
- Markdown parsing is **code-fence aware**: a `# comment` inside a ``` block is
  never treated as a heading, and heading prefixes count against the chunk
  size budget so chunks never exceed `chunkSize`.
- Abort now genuinely interrupts Transformers.js decoding
  (`InterruptableStoppingCriteria`) and Chrome sessions (native `signal`),
  including on timeout — not just abandoning the promise; already-aborted
  signals short-circuit before any provider work.
- React: concurrent `send()` calls stream into their own message bubbles
  (stable message `id`s, safe as React keys).
- The BM25 index skips rebuilding when the chunk set is unchanged.

### Notes
- 26 new tests (hybrid retrieval, BM25 keyword index, markdown chunking, abort,
  concurrency, and the React hook rendered with `@testing-library/react`),
  120 total.
- Existing IndexedDB indexes re-chunk automatically on the next `loadKnowledge`
  thanks to the index-version stamp added in 2.0.

## [2.0.0] - 2026-07-03

Production-grade rewrite focused on answer correctness, real-world Chrome/LLM
support, and packaging that actually loads everywhere.

### Fixed
- **Query classifier no longer hijacks real questions.** Queries containing
  substrings like "ty" ("warranty", "security"), or starting with "hi"
  ("history…"), "yes" ("yesterday…"), "great", "no" were answered with canned
  small-talk instead of retrieval. Small talk now requires the entire message
  to match; keyword-based "out of scope" refusals (weather/forecast/
  temperature/time) are gone — retrieval decides.
- **Answer cache is invalidated when knowledge changes**, expired entries are
  no longer served (TTL enforced on read), eviction is true LRU, and
  "no information" responses are never cached.
- **Chunker terminates on all inputs.** The previous overlap guard compared a
  text offset to a string length and could infinite-loop (e.g. chunkSize 300 /
  overlap 290), duplicate content, or silently drop mid-document chunks.
  Chunking is now paragraph-first with sentence-aligned overlap and never
  drops content.
- **Embedding failures throw instead of silently returning zero vectors** that
  poisoned the persisted index.
- **Multilingual queries survive normalization** (Unicode-aware; Hindi/Chinese/
  accented queries no longer collapse to an empty cache key).
- **`import 'dhiya-npm'` works in Node ESM, Vite SSR, and CDNs** — compiled
  output now uses explicit `.js` specifiers. A packaging smoke test runs on
  every publish.
- Re-ingesting unnamed sources no longer re-embeds and duplicates the entire
  knowledge base on every page load (stable default document ids).
- URL ingestion strips `<script>`/`<style>` content before indexing.
- Failed LLM initialization is remembered instead of re-probed (and re-timed-out)
  on every question.

### Changed
- **Chrome built-in AI provider now targets the shipped Prompt API** (global
  `LanguageModel`, Chrome 138+). The old `window.ai.languageModel` origin-trial
  surface it previously used no longer exists, so the provider never activated.
- **Default local LLM is `onnx-community/Qwen2.5-0.5B-Instruct`** (chat-tuned,
  grounded prompting) replacing DistilGPT-2, a 2019 base model that produced
  hallucinated "enhancements".
- **Paragraph-granular chunking.** Paragraphs are now the retrieval unit
  (heading-like fragments merge forward; oversized paragraphs split on
  sentences with overlap) instead of packing unrelated topics into one
  chunk, which diluted cosine similarity enough to miss obvious questions.
  Verified in-browser with real MiniLM embeddings: FAQ-style KBs went from
  1 diluted chunk (missed queries) to per-topic chunks answering correctly.
  Existing indexes re-chunk automatically on the next `loadKnowledge` via an
  index-version stamp in the document manifest.
- **Upgraded to `@huggingface/transformers` v4** (from the unmaintained
  `@xenova/transformers` v2): embeddings genuinely run on WebGPU with WASM
  fallback — previously the selected device was never applied and the "WebGPU
  embeddings" claim was aspirational.
- `singleAnswerMode` now defaults to `false`; the hidden "definitional query"
  heuristic that truncated answers to the first sentence of the top chunk is
  removed. Answers are grounded LLM responses (or focused extractive snippets).
- **ESM-only package.** The CJS build never loaded (`dist-cjs` lacked a
  CommonJS package.json under a `"type": "module"` root) and is removed; the
  exports map now includes `types`/`default` conditions and `./package.json`.
- Embeddings are persisted as `Float32Array` (half the IndexedDB footprint).
- Requires Node >= 18 for tooling; browsers are the runtime target.

### Added
- **Chrome Summarizer API provider** (`chrome-summarizer`): on-device answers
  on stable Chrome 138+ web pages (where the Prompt API is extensions-only),
  answering as question-focused summaries of the retrieved context — no
  Transformers.js model download needed when Gemini Nano is present. Default
  fallback order is now `chrome-ai` → `chrome-summarizer` → `transformers`.
- **`<dhiya-chat>` web component** (`dhiya-npm/widget`): a complete floating
  chat UI configurable via attributes, with inline or URL knowledge sources —
  one script tag to integrate on any site.
- **Token streaming**: `ask(query, { onToken })` streams from both Chrome AI
  (`promptStreaming`) and Transformers.js (`TextStreamer`).
- `search(query)` for raw scored retrieval, `removeDocument(docId)`,
  `skipCache`, configurable `noAnswerMessage`, and
  `disableQueryClassification`.
- Honest README: no fabricated benchmarks, real browser support matrix,
  model download sizes stated up front, working CDN snippet.
- Test suite rewritten: 92 tests including deterministic retrieval-ranking
  tests, storage TTL/LRU tests, LLM fallback tests, and regressions for every
  bug above.

### Removed
- Unpublished, non-building framework wrapper packages (`packages/dhiya-react`,
  `dhiya-vue`, `dhiya-svelte`) and their CI publish jobs. The `<dhiya-chat>`
  widget plus the core API cover framework integration; wrappers may return as
  separate, tested packages.
- 73 MB of committed ONNX WASM binaries in the example app; a dozen internal
  status/checklist documents; the broken `examples/` snippets.

### Migration from 1.x
- Use `import` (ESM). If you called `require('dhiya-npm')` — that never worked
  in 1.x either.
- Default answers are now full grounded responses; set
  `singleAnswerMode: true` to keep 1.x-style short snippets.
- `strictRAG`, `minChunksForLLM`, and `AskOptions.useRewrite` were removed
  (`minLLMSimilarity` covers hallucination gating; `useRewrite` was a no-op).
- The default Transformers model changed; the old GPT-2 family still works if
  you explicitly set `transformersModel`, but is not recommended.
- Chunk embeddings read back from storage are `Float32Array`, not `number[]`.

## [1.0.2] - 2025-10-15

### Added
- Comprehensive README refresh with “client-side RAG” focused messaging, benchmarks, CDN usage, and API reference
- CommonJS build output alongside ESM (`dist-cjs`) plus dual exports for Node compatibility
- SEO-oriented keyword set and badge lineup to improve npm ranking
- Funding metadata and side-effect hints for better ecosystem scoring

### Changed
- Build pipeline now produces ESM, CJS, and declaration outputs in a single `npm run build`
- README front-loads install + quickstart and weaves in key search phrases (“browser rag”, “offline rag”, “rag framework”)

### Fixed
- Clean script now clears both `dist` and `dist-cjs` directories to prevent stale builds

## [1.0.1] - 2025-10-15

### Added
- Runtime-configurable LLM options for Chrome AI and Transformers.js (prompts, temperatures, token limits, caching)
- Ability to define custom LLM fallback order directly in client configuration
- Public exports for default LLM option presets and curated Transformers model list
- Enhanced documentation covering provider selection and configuration tips

### Changed
- DhiyaClient now forwards deep LLM configuration into the LLM manager at initialization
- Transformers provider dynamically reports the active model during load/cleanup for clearer debugging
- Updated dev toolchain (Vitest/ui 3.2.4, happy-dom 20.0.1) to align with latest ecosystem releases

### Fixed
- TypeScript merging logic for LLM options now preserves strong types when overriding defaults
- Resolved npm cache warning in CI by tracking `package-lock.json`

## [1.0.0] - 2025-10-14

### Added
- Initial release of dhiya-npm
- Client-side RAG (Retrieval-Augmented Generation) framework for browsers
- Zero-config initialization with production-ready defaults
- Multi-format knowledge ingestion (JSON, text, URL, array)
- Semantic search with embeddings (Xenova/transformers)
- Multi-tier LLM fallback (Chrome AI → Transformers.js → RAG-only)
- Built-in anti-hallucination controls:
  - Strict RAG mode (default: enabled)
  - Similarity gating for LLM calls
  - Knowledge base size checks
  - Context length limiting
- Single answer mode for concise responses (default: enabled)
- Answer length limiting (default: 320 characters)
- Confidence scoring with top-3 average
- Source attribution with `topSource` field
- IndexedDB persistence with caching
- TypeScript support with full type definitions
- Progress callbacks for initialization and processing
- Comprehensive error handling and graceful fallbacks
- Browser compatibility (Chrome, Edge, Firefox, Safari)
- Complete example application with UI
- Debug mode for troubleshooting

### Features
- **Zero Server Dependency**: Runs entirely in the browser
- **Privacy-First**: All processing happens locally
- **Offline Capable**: Works offline after initial model download
- **Smart Gating**: Prevents unnecessary LLM calls
- **Flexible Configuration**: Customize behavior while maintaining safe defaults
- **Multiple Data Sources**: Support for various input formats
- **Performance Optimized**: Efficient retrieval and generation
- **Production Ready**: Robust error handling and validation

### Documentation
- Comprehensive README with API reference
- Quick start guide (QUICK-START.md)
- Package readiness checklist (PACKAGE-READINESS.md)
- Production ready report (PRODUCTION-READY-REPORT.md)
- Verification documentation (VERIFICATION-COMPLETE.md)
- Inline JSDoc comments throughout codebase
- Full TypeScript type definitions
- Working example application

### Dependencies
- @xenova/transformers: ^2.17.2 (for embeddings and LLM)
- idb: ^8.0.3 (for IndexedDB storage)

### Browser Support
- Chrome/Edge 90+ (with Chrome AI support)
- Firefox 90+
- Safari 14+
- Any modern browser with WASM and IndexedDB support

[1.0.2]: https://github.com/Xwits-Developers/dhiya-npm/releases/tag/v1.0.2
[1.0.1]: https://github.com/Xwits-Developers/dhiya-npm/releases/tag/v1.0.1
[1.0.0]: https://github.com/Xwits-Developers/dhiya-npm/releases/tag/v1.0.0
