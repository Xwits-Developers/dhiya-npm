# Dhiya Chatbot Example

A complete, production-ready example demonstrating the **dhiya-npm** package - a client-side RAG (Retrieval-Augmented Generation) chatbot framework.

## Features Demonstrated

✨ **Client-Side RAG**: All processing happens in the browser - no server required  
🧠 **Multi-tier LLM Fallback**: Chrome AI → Transformers.js → Template responses  
📚 **Knowledge Base Loading**: Load JSON, raw text, arrays, URLs, uploaded files  
🔍 **Semantic Search**: Find relevant context using embeddings  
💬 **Interactive Chat UI**: Beautiful, responsive chat interface  
📊 **Real-time Status**: See chunks loaded, model being used, and performance metrics  

## Quick Start

### 1. Install Dependencies

```bash
npm install --omit=optional
```

> **Note:** We use `--omit=optional` to skip optional native dependencies from @xenova/transformers (like sharp) which aren't needed for browser usage.

### 2. Run Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3000`

### 3. Try It Out!

1. **Load Knowledge**: Click "Load AI Knowledge", "Load Company Info" or use Custom Inputs section
2. **Ask Questions**: Type questions like:
   - "What is machine learning?"
   - "What are transformers in AI?"
   - "What are your support hours?"
   - "How much does the professional plan cost?"
3. **See Results**: Watch as Dhiya retrieves relevant context and generates answers

## Project Structure

```
example/
├── index.html          # Main HTML with embedded styles
├── src/
│   └── main.ts        # TypeScript application logic
├── package.json       # Dependencies and scripts
├── vite.config.ts     # Vite configuration
└── tsconfig.json      # TypeScript configuration
```

## How It Works

### 1. Initialization

```typescript
const client = new DhiyaClient({
  debug: true,
  enableLLM: true
});

await client.initialize();
```

### 2. Load Knowledge

```typescript
const knowledge: KnowledgeSource = {
  type: 'json',
  data: [
    {
      title: 'Machine Learning',
      content: 'Machine Learning is...'
    }
  ]
};

await client.loadKnowledge(knowledge);
```

### 3. Ask Questions

```typescript
const answer = await client.ask('What is machine learning?');

console.log(answer.text);        // Generated answer
console.log(answer.confidence);  // Confidence score (0-1)
console.log(answer.sources);     // Retrieved sources
console.log(answer.timing);      // Performance metrics
```

## Knowledge Ingestion Strategies

The example demonstrates all supported `KnowledgeSource` types:

| Type | How to Use | Example |
|------|------------|---------|
| json | Provide array/object with content fields | `Load AI Knowledge` button |
| text | Raw text area or uploaded .txt/.md file | Custom Inputs → Text / File |
| array | Predefined glossary list | "Load Array" button (Glossary) |
| url | Fetch and strip HTML (simple) | Point to `/sample-page.html` or external URL |
| file (json) | Upload .json -> parsed as JSON source | Upload File (.json) |

Custom ingestion controls let you:
1. Click a mode (Text / JSON / URL / File / Array)
2. Enter or select data
3. Press Ingest – chunks are created, embedded, and indexed

Minimal examples:

```typescript
// Text
await client.loadKnowledge({ type: 'text', content: 'Plain text content', documentId: 'doc1' });

// JSON (object or array)
await client.loadKnowledge({ type: 'json', data: [{ title: 'T', content: 'C' }], documentId: 'doc2' });

// Array
await client.loadKnowledge({ type: 'array', items: ['Fact A', 'Fact B'], documentId: 'doc3' });

// URL (basic fetch + tag strip)
await client.loadKnowledge({ type: 'url', url: '/sample-page.html', documentId: 'doc4' });
```

## Customization

### Change Knowledge Base

Edit the `AI_KNOWLEDGE` or `COMPANY_KNOWLEDGE` objects in `src/main.ts`:

```typescript
const CUSTOM_KNOWLEDGE: KnowledgeSource = {
  type: 'json',
  data: [
    {
      title: 'Your Topic',
      content: 'Your content here...'
    }
  ]
};
```

### Modify UI Styles

All styles are in `index.html` within the `<style>` tag. Customize colors, fonts, and layout as needed.

### Add New Features

The example demonstrates core features. You can extend it with:
- File upload for knowledge bases
- PDF/text extraction
- Conversation history persistence
- Export chat functionality
- Multi-language support

## Browser Requirements

- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Optional**: Chrome 127+ with AI APIs enabled for best performance

### Enable Chrome AI (Optional)

For the fastest performance using built-in Chrome AI:

1. Use Chrome Canary/Dev (version 127+)
2. Enable flags:
   - `chrome://flags/#optimization-guide-on-device-model`
   - `chrome://flags/#prompt-api-for-gemini-nano`
3. Download Gemini Nano model (happens automatically)

Without Chrome AI, dhiya-npm falls back to Transformers.js (DistilGPT-2) or template responses.

## Performance Notes

- **First Load**: May take 5-10 seconds to download embedding model
- **Subsequent Loads**: Models are cached in IndexedDB
- **Query Response**: Typically 50-200ms for retrieval + generation
- **Knowledge Loading**: ~100-500ms depending on size

## Building for Production

```bash
npm run build
```

Output will be in `dist/` directory. Deploy to any static hosting service:
- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages
- AWS S3

## Clean Install UX

`dhiya-npm` bundles all runtime dependencies required for browser usage. After installing the package (and this example's dev tooling) you do NOT need to manually install any peer libraries. We deliberately avoid peer dependencies to ensure a smooth one-command setup.

If you build your own project:
```bash
npm install dhiya-npm @xenova/transformers idb --omit=optional
```
The optional flag skips native binaries not needed in the browser.

## Troubleshooting

### Installation fails?
- Use `npm install --omit=optional` to skip native dependencies
- Try `npm run install:clean` to clean install
- Delete `node_modules` and `package-lock.json` then reinstall

### ONNX / backend initialization errors?
**Previous Error:** `Cannot read properties of undefined (reading 'registerBackend')`

**Cause:** Directly importing `onnxruntime-web` alongside `@xenova/transformers` created a duplicate backend initialization race leading to an undefined registry.

**Resolution Implemented:** The example no longer imports `onnxruntime-web` directly. Transformers.js internally manages the ONNX/WASM backend. The fix was:
1. Remove `onnxruntime-web` from `package.json`
2. Delete manual WASM path configuration
3. Keep a minimal `configureTransformers()` that only sets `env` flags

If you reintroduce the old error, ensure you have NOT added a direct `import 'onnxruntime-web'` anywhere. Hard refresh (Cmd+Shift+R) to clear stale bundles.

### Models not loading?
- Check browser console for errors
- Ensure internet connection for first-time model download
- Clear IndexedDB if corrupted: `chrome://settings/content/all`
- Try hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

### Slow performance?
- Enable Chrome AI flags for fastest performance
- Reduce knowledge base size
- Use shorter queries

### TypeScript errors?
- Ensure `dhiya-npm` is built: `cd .. && npm run build`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## Learn More

- [Dhiya Documentation](../README.md)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [Chrome AI APIs](https://developer.chrome.com/docs/ai)

## License

MIT - Same as dhiya-npm package
