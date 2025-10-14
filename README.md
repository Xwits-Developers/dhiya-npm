# 🧠 Dhiya NPM

> **Client-side RAG (Retrieval-Augmented Generation) framework for browsers**

[![npm version](https://img.shields.io/npm/v/dhiya-npm.svg)](https://www.npmjs.com/package/dhiya-npm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Dhiya is a production-ready, client-side RAG framework that runs **entirely in the browser**. No server required, no API keys needed, complete privacy.

## ✨ Features

- 🌐 **100% Client-Side** - Everything runs in your browser
- 🔒 **Privacy-First** - Your data never leaves the device
- 📦 **Zero Dependencies** - Works offline after first load
- 🚀 **Fast & Efficient** - WebGPU acceleration, smart caching
- 💾 **Persistent Storage** - IndexedDB for long-term storage
- 🎯 **Semantic Search** - Vector embeddings for accurate retrieval
- 🔧 **Highly Configurable** - Customize every aspect
- 📱 **Cross-Platform** - Works on desktop and mobile browsers
- 🛡️ **Hallucination Controls** - Strict RAG mode, similarity & size gating for safe answers

## 🎯 Use Cases

- 📚 Documentation sites with intelligent search
- 💬 Privacy-focused chatbots
- 🎓 Educational platforms
- 📝 Personal knowledge bases
- 🛠️ Offline-capable applications
- 💼 Customer support widgets
- 🔍 Internal knowledge management

## 📦 Installation

```bash
npm install dhiya-npm
```

Or using yarn:

```bash
yarn add dhiya-npm
```

Or using pnpm:

```bash
pnpm add dhiya-npm
```

## 🎮 Live Example

**Want to see it in action?** Check out the complete working example:

```bash
# Clone the repo
git clone https://github.com/Xwits-Developers/dhiya-npm.git
cd dhiya-npm

# Build the package
npm install
npm run build

# Run the example
npm run example
```

Or explore the [`example/`](./example) directory for a production-ready chatbot implementation with:
- 💬 Beautiful chat UI
- 📚 Multiple knowledge bases
- 🎯 Real-time status indicators
- ⚡ Performance metrics
- 🔍 Source citations

[View Example Code →](./example/src/main.ts)

## 🚀 Quick Start

### Basic Usage

```typescript
import { DhiyaClient } from 'dhiya-npm';

// Create client
const client = new DhiyaClient({
  debug: true
});

// Initialize
await client.initialize();

// Load knowledge
await client.loadKnowledge({
  type: 'json',
  data: [
    {
      title: 'Getting Started',
      content: 'Dhiya is a client-side RAG framework...'
    },
    {
      title: 'Features',
      content: 'Key features include semantic search, caching...'
    }
  ]
});

// Ask questions
const answer = await client.ask('What is Dhiya?');
console.log(answer.text);
// Output: "Dhiya is a client-side RAG framework..."
```

### HTML Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My RAG App</title>
</head>
<body>
  <input id="query" placeholder="Ask anything..." />
  <button onclick="ask()">Ask</button>
  <div id="answer"></div>

  <script type="module">
    import { DhiyaClient } from 'dhiya-npm';
    
    const client = new DhiyaClient();
    await client.initialize();
    
    await client.loadKnowledge({
      type: 'text',
      content: 'Your knowledge base content here...'
    });
    
    window.ask = async () => {
      const query = document.getElementById('query').value;
      const answer = await client.ask(query);
      document.getElementById('answer').textContent = answer.text;
    };
  </script>
</body>
</html>
```

## 📖 Knowledge Sources

### 1. JSON Data

```typescript
await client.loadKnowledge({
  type: 'json',
  documentId: 'my-docs',
  data: {
    entries: [
      { id: '1', title: 'Title', content: 'Content...' },
      { id: '2', title: 'Another', content: 'More content...' }
    ]
  }
});
```

### 2. Plain Text

```typescript
await client.loadKnowledge({
  type: 'text',
  documentId: 'readme',
  content: 'This is my knowledge base text...',
  metadata: { category: 'docs' }
});
```

### 3. Array of Strings

```typescript
await client.loadKnowledge({
  type: 'array',
  documentId: 'faqs',
  items: [
    'Q: What is RAG? A: Retrieval-Augmented Generation...',
    'Q: Is it free? A: Yes, completely free and open-source.'
  ]
});
```

### 4. From URL (with CORS)

```typescript
await client.loadKnowledge({
  type: 'url',
  url: 'https://example.com/api/knowledge',
  selector: '.content' // Optional CSS selector
});
```

## ⚙️ Configuration

```typescript
const client = new DhiyaClient({
  // Storage
  dbName: 'my-knowledge-base',
  cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxCacheSize: 100,
  
  // Embeddings
  embeddingModel: 'english', // or 'multilingual'
  device: 'auto', // 'webgpu', 'wasm', or 'cpu'
  
  // Chunking
  chunkSize: 900,
  chunkOverlap: 120,
  
  // Retrieval
  topK: 5,
  similarityThreshold: 0.25,
  useDiversity: true,
  diversityThreshold: 0.95,
  
  // Hallucination controls (optional)
  strictRAG: true,          // Avoid LLM when context already strong
  minLLMSimilarity: 0.55,    // Require minimum similarity for LLM enhancement
  minChunksForLLM: 5,        // Skip LLM if knowledge base is tiny
  maxContextChars: 1800,     // Cap context fed into LLM for focus
  
  // Advanced
  debug: false,
  onProgress: (event) => {
    console.log(event.message, event.progress);
  },
  onError: (error) => {
    console.error(error);
  }
});
```

## 🎨 API Reference

### DhiyaClient

#### Constructor

```typescript
new DhiyaClient(config?: DhiyaConfig)
```

#### Methods

##### initialize()

Initialize the client (must be called before use).

```typescript
await client.initialize();
```

##### loadKnowledge(source)

Load knowledge from a source.

```typescript
await client.loadKnowledge({
  type: 'json',
  data: [...],
  documentId: 'optional-id'
});
```

##### ask(query, options?)

Ask a question and get an answer.

```typescript
const answer = await client.ask('What is RAG?', {
  topK: 5,
  enableLLM: true
});

console.log(answer.text);
console.log(answer.confidence);
console.log(answer.sources);
console.log(answer.timing);
```

##### getStatus()

Get current system status.

```typescript
const status = await client.getStatus();
console.log(status.initialized);
console.log(status.knowledgeBase.chunkCount);
console.log(status.embedding.ready);
```

##### clear()

Clear all knowledge from storage.

```typescript
await client.clear();
```

##### destroy()

Cleanup and release resources.

```typescript
await client.destroy();
```

### Types

#### Answer

```typescript
interface Answer {
  text: string;
  sources: Source[];
  confidence: number;
  chunks: SearchResult[];
  provider?: LLMProvider;
  timing: {
    retrieval: number;
    generation: number;
    total: number;
  };
}
```

#### Source

```typescript
interface Source {
  id: string;
  title?: string;
  content: string;
  url?: string;
  similarity: number;
}
```

## 🧪 Examples

Check out the `examples/` directory:

- **simple.html** - Basic chat interface
- **advanced.js** - Advanced usage patterns

Run examples:

```bash
# Build first
npm run build

# Serve examples
npx serve .
# Open http://localhost:3000/examples/simple.html
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  User Query                     │
└───────────────────┬─────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│              DhiyaClient                        │
│  • Initialization                               │
│  • Knowledge Management                         │
│  • Query Orchestration                          │
└───────────────────┬─────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│           RAG Pipeline                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Chunker  │→ │Embeddings│→ │ Retriever│      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                      ↓                          │
│                ┌──────────┐                     │
│                │ Answerer │                     │
│                └──────────┘                     │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│              Storage Layer                      │
│  • IndexedDB (chunks, cache, manifest)          │
│  • LRU Cache Eviction                           │
│  • Checksum-based Updates                       │
└─────────────────────────────────────────────────┘
```

## 🔧 Advanced Usage

### Custom Progress Tracking

```typescript
const client = new DhiyaClient({
  onProgress: (event) => {
    if (event.type === 'indexing') {
      updateProgressBar(event.progress);
    }
    if (event.type === 'complete') {
      showSuccessMessage();
    }
  }
});
```

### Multiple Knowledge Sources

```typescript
// Load from multiple sources
await client.loadKnowledge({ type: 'json', data: docs1 });
await client.loadKnowledge({ type: 'text', content: docs2 });
await client.loadKnowledge({ type: 'url', url: 'https://...' });

// All sources are merged in the same knowledge base
```

### Hallucination Mitigation

These safeguards reduce off-topic or invented answers:

| Setting | Purpose | Default |
|---------|---------|---------|
| `strictRAG` | Disables LLM enhancement when confidence already high or KB small | `true` |
| `minLLMSimilarity` | Similarity gate before LLM call | `0.55` |
| `minChunksForLLM` | Require minimum indexed chunks | `5` |
| `maxContextChars` | Truncate context passed to LLM | `1800` |
| `singleAnswerMode` | Return only highest-confidence snippet | `true` |
| `answerLengthLimit` | Cap characters in single answer mode | `320` |

If a query has low similarity AND KB is small (< `minChunksForLLM`), Dhiya will answer:
"I don't have enough information to answer that question." rather than hallucinating.
```

### Conversation History (Coming Soon)

```typescript
const conversationHistory = [];

const answer1 = await client.ask('What is RAG?');
conversationHistory.push({ query: 'What is RAG?', answer: answer1.text });

const answer2 = await client.ask('How does it work?', {
  conversationHistory
});
```

## 🎯 Performance

### Benchmarks (Typical Desktop)

- **Initialization**: ~2-3 seconds
- **Indexing**: ~50-100 chunks/second
- **Embedding**: ~50-200ms per chunk (WebGPU)
- **Retrieval**: ~10-50ms for 1000 chunks
- **Total Query Time**: ~100-500ms (cached: <10ms)

### Memory Usage

- **Embeddings Model**: ~50MB
- **1000 Chunks**: ~2-3MB
- **Cache**: ~1-5MB (configurable)

## 🌐 Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Core RAG | ✅ | ✅ | ✅ | ✅ |
| WebGPU | ✅ | 🟡 | ❌ | ✅ |
| WASM | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |

- ✅ Full support
- 🟡 Experimental support
- ❌ Not supported

## 📝 Roadmap

- [x] Core RAG pipeline
- [x] IndexedDB storage
- [x] Semantic search
- [x] Answer caching
- [ ] LLM integration (Chrome AI, Transformers.js)
- [ ] Streaming responses
- [ ] Multi-language support
- [ ] PDF/Markdown loaders
- [ ] Vector database optimization
- [ ] React/Vue/Svelte components

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

```bash
# Clone the repo
git clone https://github.com/Xwits-Developers/dhiya-npm.git

# Install dependencies
npm install

# Build
npm run build

# Run examples
npm run dev
```

## 📄 License

MIT © Xwits Developers Private Limited

## 🙏 Acknowledgments

- **Transformers.js** - Browser-based model inference
- **idb** - IndexedDB wrapper
- **Xenova** - Pre-trained embedding models

## 📧 Contact

- **Author**: Deep Parmar
- **Email**: deep@xwits.dev
- **GitHub**: [@Xwits-Developers](https://github.com/Xwits-Developers)
- **Website**: [Xwits Developers](https://xwits.dev/)
- **Website**: [Deep Parmar](https://deepap.dev/)

## ⭐ Show Your Support

If you find Dhiya useful, please consider giving it a star on GitHub!

---

**Made with ❤️ by Deep Parmar | Xwits Developers Private Limited**
