# 🚀 Quick Start Guide - Dhiya Example

## TL;DR - Get Running in 30 Seconds

```bash
# From the example directory
npm install --omit=optional
npm run dev
```

Then open http://localhost:3000

## What to Do First

1. **Click "Load AI Knowledge"** - Loads sample AI/ML content
2. **Ask a question** like:
   - "What is machine learning?"
   - "Explain transformers"
   - "What is RAG?"

3. **Watch it work!** You'll see:
   - Confidence scores
   - Source citations
   - Performance metrics (timing)

## Common Issues & Fixes

### ❌ "Initialization failed" / ONNX Runtime Error

**Error:** `Cannot read properties of undefined (reading 'registerBackend')`

This happens when ONNX Runtime isn't configured before it tries to initialize.

**✅ Already Fixed:** The example code has this solved:
- `src/config.ts` is imported FIRST
- ONNX Runtime is configured at module load time
- WASM files load from CDN automatically

**If you still see the error:**

**Solution 1:** Hard refresh the browser
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

**Solution 2:** Clean install dependencies
```bash
npm run install:clean
```

**Solution 3:** Check imports order
Make sure `src/main.ts` imports `config.ts` FIRST:
```typescript
// CORRECT - config first
import { configureTransformers } from './config';
import { DhiyaClient } from 'dhiya-npm';

// WRONG - dhiya-npm first
import { DhiyaClient } from 'dhiya-npm';
import { configureTransformers } from './config';
```

### ❌ "Failed to load knowledge"

**Causes:**
- First time loading models (takes 5-10 seconds)
- Slow internet connection
- Browser cache issues

**Solutions:**
1. Wait a bit longer (check browser console)
2. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Clear IndexedDB: Open DevTools → Application → Storage → Clear site data

### ❌ Module not found errors

Make sure you've built the parent package first:
```bash
cd ..
npm run build
cd example
npm install --omit=optional
```

## First Time Setup (Complete)

```bash
# 1. Clone/navigate to repo
cd /path/to/dhiya-npm

# 2. Install root dependencies
npm install

# 3. Build the package
npm run build

# 4. Go to example
cd example

# 5. Install example dependencies (skip optional)
npm install --omit=optional

# 6. Start dev server
npm run dev
```

## What Each Button Does

### 📚 Load AI Knowledge
Loads content about:
- Machine Learning basics
- Deep Learning concepts
- NLP fundamentals
- Neural Networks
- Transformers architecture
- RAG technology

**Try asking:**
- "What is machine learning?"
- "How do transformers work?"
- "Explain deep learning"

### 📚 Load Company Info
Loads fictional company data about:
- Company overview
- Products & services
- Support hours
- Pricing tiers

**Try asking:**
- "What products do you offer?"
- "What are your support hours?"
- "How much is the professional plan?"

### 🗑️ Clear Knowledge
Removes all loaded knowledge from the database. Use this to:
- Start fresh
- Free up browser storage
- Test loading again

## Understanding the UI

### Status Bar (Top)
- **Status Dot** 
  - 🟡 Yellow = Loading
  - 🟢 Green = Ready
- **Chunks** = Number of text segments indexed
- **Model** = Which LLM is being used

### Chat Interface
- **Left side** = Bot responses (gray bubbles)
- **Right side** = Your messages (purple bubbles)

### Bot Response Details
Each response shows:
- **Main answer** - Generated text
- **Confidence** - How confident the system is (0-100%)
- **Sources** - Which knowledge chunks were used
- **Timing** - How long the query took (ms)

## Performance Tips

### First Load
- Models download automatically (5-10 seconds)
- Cached for future use
- Happens once per browser

### Subsequent Loads
- Models load from cache (1-2 seconds)
- Queries respond in 50-200ms
- Very fast after initialization!

### Optimization
1. **Enable Chrome AI** (fastest)
   - Use Chrome Canary/Dev
   - Enable AI flags
   - Get native performance

2. **Use WiFi** (for first load)
   - Models are ~50-100MB
   - Download once, cached forever

3. **Keep browser tab open**
   - Models stay in memory
   - Instant responses

## Development Tips

### Live Reload
Vite auto-reloads when you edit:
- `src/main.ts` - Application logic
- `index.html` - UI and styles

### Debug Mode
The example has `debug: true` enabled. Check console for:
- Initialization logs
- Model loading progress
- Query processing steps
- Error messages

### Browser DevTools
Press F12 to open DevTools:
- **Console** - See debug logs
- **Network** - Watch model downloads
- **Application** - View IndexedDB storage

## Next Steps

1. ✅ Get it running (you're here!)
2. 📖 Read the [TUTORIAL.md](./TUTORIAL.md)
3. 🎨 Customize the UI
4. 🔧 Add your own knowledge
5. 🚀 Deploy it!

## Still Having Issues?

1. Check the [TUTORIAL.md](./TUTORIAL.md) for detailed explanations
2. See [README.md](./README.md) for full documentation
3. Open an issue on [GitHub](https://github.com/Xwits-Developers/dhiya-npm/issues)
4. Email: deep.parmar@sunbots.in

---

Made with ❤️ using Dhiya NPM
