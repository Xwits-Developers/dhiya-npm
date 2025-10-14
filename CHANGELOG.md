# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/Xwits-Developers/dhiya-npm/releases/tag/v1.0.0
