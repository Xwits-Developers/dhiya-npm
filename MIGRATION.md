# 🔄 Migration Guide: From Dhiya (armar-ai-hub) to dhiya-npm

This guide helps you understand how to reuse or adapt components from your existing Dhiya implementation in `armar-ai-hub` for the `dhiya-npm` package.

## 📦 Component Mapping

### From armar-ai-hub to dhiya-npm

| armar-ai-hub | dhiya-npm | Notes |
|--------------|-----------|-------|
| `src/lib/rag/embeddings.ts` | `src/rag/embeddings.ts` | ✅ Reusable with minor changes |
| `src/lib/rag/chunker.ts` | `src/rag/chunker.ts` | ✅ Directly portable |
| `src/lib/rag/retriever.ts` | `src/rag/retriever.ts` | ✅ Core logic same |
| `src/lib/rag/answerer.ts` | `src/rag/answerer.ts` | ⚠️ Simplified (no LLM yet) |
| `src/lib/rag/storage.ts` | `src/storage/indexeddb.ts` | ✅ Enhanced with `idb` wrapper |
| `src/lib/rag/indexer.ts` | Built into `DhiyaClient` | 🔄 Merged into main class |
| `src/hooks/useRAG.ts` | `src/dhiya-client.ts` | 🔄 React hook → Plain class |
| `src/lib/llm/*` | Future addition | ⏳ Coming in v2.0 |

## 🔧 Key Adaptations

### 1. Embeddings Module

**armar-ai-hub approach:**
```typescript
// Singleton pattern with global state
export async function initEmbeddings(model: EmbeddingModel): Promise<void> {
  // Initialize global pipeline
}

export async function embed(text: string): Promise<number[]> {
  // Use global pipeline
}
```

**dhiya-npm approach:**
```typescript
// Class-based for better encapsulation
export class EmbeddingManager {
  private model: any = null;
  
  async initialize(modelType: EmbeddingModel): Promise<void> {
    // Initialize instance pipeline
  }
  
  async embed(text: string): Promise<number[]> {
    // Use instance pipeline
  }
}
```

**Why?** Better for library usage - multiple instances, easier testing, no global state pollution.

### 2. Storage Layer

**armar-ai-hub approach:**
```typescript
// Direct IndexedDB calls
import { openDB } from 'idb';

const db = await openDB('knowledge-base', 2, {
  upgrade(db) {
    // Manual schema setup
  }
});

await db.put('chunks', chunk);
```

**dhiya-npm approach:**
```typescript
// Wrapped in StorageManager class
export class StorageManager {
  private db: IDBPDatabase<DhiyaDB> | null = null;
  
  async initialize(): Promise<void> {
    this.db = await openDB<DhiyaDB>(...);
  }
  
  async saveChunks(chunks: Chunk[]): Promise<void> {
    // Encapsulated operations
  }
}
```

**Why?** Better abstraction, easier to swap storage backends, cleaner API.

### 3. React Hook → Plain Client

**armar-ai-hub approach:**
```typescript
// React-specific
export function useRAG() {
  const [status, setStatus] = useState<ModelStatus>(...);
  
  useEffect(() => {
    initializeRAG();
  }, []);
  
  const ask = useCallback(async (query: string) => {
    return await generateAnswer(query);
  }, []);
  
  return { status, ask, ... };
}
```

**dhiya-npm approach:**
```typescript
// Framework-agnostic
export class DhiyaClient {
  private initialized = false;
  
  async initialize(): Promise<void> {
    // Init logic
  }
  
  async ask(query: string): Promise<Answer> {
    // Query logic
  }
}
```

**Why?** Works in any JS environment - React, Vue, Svelte, vanilla JS, Node.js.

### 4. Configuration

**armar-ai-hub approach:**
```typescript
// Scattered constants
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;
const MIN_SIMILARITY = 0.25;
```

**dhiya-npm approach:**
```typescript
// Centralized config object
export const DEFAULT_CONFIG: Required<DhiyaConfig> = {
  chunkSize: 900,
  chunkOverlap: 120,
  similarityThreshold: 0.25,
  // All config in one place
};

// User can override
const client = new DhiyaClient({
  chunkSize: 1000,
  // ...custom config
});
```

**Why?** Easier to document, test, and customize.

## 🚀 Reusing Existing Code

### Directly Portable Components

These can be copy-pasted with minimal changes:

1. **Chunking Logic** (`chunker.ts`)
   - Sentence boundary detection
   - Overlap calculation
   - Smart splitting

2. **Similarity Functions** (`utils/similarity.ts`)
   - Cosine similarity
   - Euclidean distance
   - Vector normalization

3. **Text Preprocessing** (`utils/normalize.ts`)
   - Query normalization
   - Stop word removal
   - URL extraction

### Components Needing Adaptation

1. **Answerer Module**
   - Remove LLM-specific logic for now
   - Keep RAG synthesis
   - Add LLM as optional enhancement later

2. **Query Classifier**
   - Simplified version for initial release
   - Full query classification in v2.0

3. **Service Worker**
   - Not included in core library
   - User can add separately if needed

## 📚 Adding LLM Support (Future)

When you're ready to add LLM support to dhiya-npm:

```typescript
// src/llm/llm-manager.ts - Port from armar-ai-hub
export class LLMManager {
  async initialize(): Promise<void> {
    // Try Chrome AI first
    // Fall back to Transformers.js
  }
  
  async generate(prompt: string): Promise<string> {
    // Use active provider
  }
}

// Integrate into DhiyaClient
export class DhiyaClient {
  private llm?: LLMManager;
  
  constructor(config: DhiyaConfig) {
    if (config.enableLLM) {
      this.llm = new LLMManager();
    }
  }
  
  async ask(query: string): Promise<Answer> {
    // RAG retrieval first
    const chunks = await this.retrieve(query);
    
    // Optionally enhance with LLM
    if (this.llm && config.enableLLM) {
      const enhanced = await this.llm.enhance(query, chunks);
      return enhanced;
    }
    
    // Return RAG-only answer
    return synthesize(chunks);
  }
}
```

## 🎯 Best Practices for Migration

### 1. Progressive Enhancement

Start with core RAG, add LLM later:

```typescript
// v1.0 - Core RAG only
const client = new DhiyaClient();

// v2.0 - Optional LLM
const client = new DhiyaClient({
  enableLLM: true,
  preferredProvider: 'chrome-ai'
});
```

### 2. Backward Compatibility

Keep old APIs working:

```typescript
// Old way (armar-ai-hub)
const answer = await generateAnswer(query, 5, false, true);

// New way (dhiya-npm)
const answer = await client.ask(query, {
  topK: 5,
  enableLLM: true
});
```

### 3. Framework Wrappers

Create framework-specific wrappers:

```typescript
// packages/dhiya-react/src/useRAG.ts
import { DhiyaClient } from 'dhiya-npm';

export function useRAG(config?: DhiyaConfig) {
  const [client] = useState(() => new DhiyaClient(config));
  const [status, setStatus] = useState<ClientStatus>(...);
  
  useEffect(() => {
    client.initialize().then(() => {
      setStatus({ initialized: true, ... });
    });
  }, []);
  
  const ask = useCallback(async (query: string) => {
    return await client.ask(query);
  }, [client]);
  
  return { status, ask };
}
```

## 📦 Package Structure

```
dhiya-npm/
├── src/                  # Core library (framework-agnostic)
├── packages/
│   ├── dhiya-react/      # React bindings
│   ├── dhiya-vue/        # Vue bindings
│   └── dhiya-svelte/     # Svelte bindings
└── examples/
    ├── vanilla/          # Plain JS
    ├── react/            # React app
    └── vue/              # Vue app
```

## 🔬 Testing Strategy

Port your existing tests:

```typescript
// armar-ai-hub test patterns
describe('RAG Pipeline', () => {
  it('should chunk text correctly', () => {
    const chunks = chunkText(text, { size: 900, overlap: 120 });
    expect(chunks).toHaveLength(expected);
  });
  
  it('should retrieve relevant chunks', async () => {
    const results = await retrieve(query, 5);
    expect(results[0].similarity).toBeGreaterThan(0.5);
  });
});

// Port to dhiya-npm (same tests, different imports)
import { DhiyaClient } from '../src/dhiya-client';

describe('DhiyaClient', () => {
  it('should initialize correctly', async () => {
    const client = new DhiyaClient();
    await client.initialize();
    const status = await client.getStatus();
    expect(status.initialized).toBe(true);
  });
});
```

## 🎉 Summary

**Core Philosophy:**
- **armar-ai-hub**: Application-specific, React-integrated, feature-rich
- **dhiya-npm**: Library-first, framework-agnostic, modular

**Migration Path:**
1. ✅ Core RAG components → Directly portable
2. ✅ Storage & caching → Enhanced with better abstraction
3. ⏳ LLM integration → Plan for v2.0
4. ⏳ Framework bindings → Separate packages

**Result:**
A reusable library that anyone can integrate, while maintaining the quality and learnings from your armar-ai-hub implementation!

---

**Next Steps:**
1. Test the core library thoroughly
2. Create React wrapper (dhiya-react)
3. Add LLM support (v2.0)
4. Publish to npm
5. Build community!
