# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
