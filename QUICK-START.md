# 🚀 Dhiya Quick Start - 30 Second Setup

## Install
```bash
npm install dhiya-npm
```

## Use (3 lines!)
```javascript
import { DhiyaClient } from 'dhiya-npm';

const bot = new DhiyaClient();
await bot.initialize();
await bot.loadKnowledge({ type: 'json', data: [{ title: 'Topic', content: 'Info...' }] });
const answer = await bot.ask('Your question?');

console.log(answer.text);        // The answer
console.log(answer.confidence);  // 0.0 - 1.0
console.log(answer.topSource);   // Best source
```

## That's It! ✅

**Built-in Features (no config needed):**
- ✅ Concise answers (single sentence extraction)
- ✅ High confidence scoring
- ✅ No hallucinations (strict RAG mode)
- ✅ Source attribution
- ✅ Smart LLM fallback
- ✅ Works offline (after model load)

## Data Ingestion Methods

```javascript
// JSON Array
await bot.loadKnowledge({
  type: 'json',
  data: [{ title: 'X', content: 'Y' }, ...]
});

// Plain Text
await bot.loadKnowledge({
  type: 'text',
  content: 'Your text here...'
});

// URL
await bot.loadKnowledge({
  type: 'url',
  url: 'https://example.com/data.json'
});

// Array of strings
await bot.loadKnowledge({
  type: 'array',
  items: ['Fact 1', 'Fact 2', ...]
});
```

## Optional Configuration

```javascript
const bot = new DhiyaClient({
  singleAnswerMode: false,    // Multi-source answers
  answerLengthLimit: 500,     // Longer answers
  enableLLM: false,           // Pure RAG (no LLM)
  debug: true                 // Show logs
});
```

## Answer Structure

```typescript
{
  text: string;           // The answer
  confidence: number;     // 0.0 - 1.0
  topSource?: {           // Best matching source
    id: string;
    title?: string;
    similarity: number;
  };
  sources: Array<...>;    // All relevant sources
  timing: {
    total: number;        // Total ms
    retrieval: number;    // Retrieval ms
    generation?: number;  // LLM ms (if used)
  }
}
```

## Example

```javascript
import { DhiyaClient } from 'dhiya-npm';

const bot = new DhiyaClient();
await bot.initialize();

await bot.loadKnowledge({
  type: 'json',
  data: [
    {
      title: 'Machine Learning',
      content: 'Machine Learning is a subset of AI that enables systems to learn from data...'
    },
    {
      title: 'Deep Learning',
      content: 'Deep Learning uses neural networks with multiple layers...'
    }
  ]
});

const answer = await bot.ask('What is machine learning?');
// Output: "Machine Learning is a subset of AI that enables systems to learn from data..."
// Confidence: 0.89
// Time: ~200ms
```

## Live Demo

```bash
git clone <repo>
cd dhiya-npm/example
npm install
npm run dev
# Open http://localhost:3000
```

## Docs

Full documentation: `/README.md`  
API Reference: TypeScript definitions included  
Browser Support: Chrome, Edge, Firefox, Safari (modern versions)

---

**No server required • No API keys • Privacy-first • Production-ready**
