# 🎓 Example Tutorial: Building a RAG Chatbot with Dhiya

This guide walks you through the complete example chatbot implementation included in `dhiya-npm`.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup](#setup)
4. [Code Walkthrough](#code-walkthrough)
5. [Customization](#customization)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

## Overview

The example demonstrates a fully-functional chatbot using **dhiya-npm** that:
- Runs entirely in the browser (no server required)
- Supports multiple knowledge bases
- Shows real-time performance metrics
- Provides source citations for answers
- Uses a beautiful, responsive UI

### What You'll Learn

✅ How to initialize the Dhiya client  
✅ How to load and manage knowledge bases  
✅ How to handle user queries and responses  
✅ How to display sources and confidence scores  
✅ How to build a production-ready chat interface  

## Architecture

```
┌─────────────────────────────────────────┐
│         Browser Application             │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │       Chat UI (index.html)       │  │
│  └──────────────────────────────────┘  │
│                  ↕                      │
│  ┌──────────────────────────────────┐  │
│  │   Application Logic (main.ts)    │  │
│  └──────────────────────────────────┘  │
│                  ↕                      │
│  ┌──────────────────────────────────┐  │
│  │     DhiyaClient (dhiya-npm)      │  │
│  └──────────────────────────────────┘  │
│         ↙        ↓        ↘            │
│  ┌───────┐  ┌────────┐  ┌──────────┐  │
│  │ RAG   │  │ LLM    │  │ Storage  │  │
│  │Engine │  │Manager │  │ Manager  │  │
│  └───────┘  └────────┘  └──────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

## Setup

### Prerequisites

- Node.js 16+
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+)

### Installation

```bash
# Clone or navigate to the example directory
cd example

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000`

## Code Walkthrough

### 1. Initializing the Client

```typescript
// src/main.ts
import { DhiyaClient } from 'dhiya-npm';

const client = new DhiyaClient({
  debug: true,      // Enable console logging
  enableLLM: true   // Enable LLM fallback
});

await client.initialize();
```

**Key Options:**
- `debug`: Logs operations to console (useful for development)
- `enableLLM`: Enables multi-tier LLM fallback (Chrome AI → Transformers.js → Templates)

### 2. Defining Knowledge Sources

```typescript
const AI_KNOWLEDGE: KnowledgeSource = {
  type: 'json',
  data: [
    {
      title: 'Machine Learning',
      content: 'Machine Learning is a subset of AI...'
    },
    {
      title: 'Deep Learning',
      content: 'Deep learning uses neural networks...'
    }
  ]
};
```

**Knowledge Source Types:**
- `json`: Array of objects with `title` and `content`
- `text`: Plain text string (will be automatically chunked)
- `url`: Fetch content from a URL (future feature)

### 3. Loading Knowledge

```typescript
async function loadKnowledge(source: KnowledgeSource, name: string) {
  try {
    await client.loadKnowledge(source);
    
    // Update status
    const status = await client.getStatus();
    console.log(`Loaded ${status.knowledgeBase.chunkCount} chunks`);
    
    // Show success message
    addMessage('bot', `✅ Successfully loaded ${name} knowledge base!`);
  } catch (error) {
    console.error('Failed to load knowledge:', error);
  }
}
```

**What Happens:**
1. Content is cleaned and normalized
2. Text is split into overlapping chunks
3. Each chunk is embedded into a vector
4. Vectors are stored in IndexedDB
5. Status is updated with new chunk count

### 4. Asking Questions

```typescript
async function handleQuery() {
  const query = queryInput.value.trim();
  
  // Show typing indicator
  showTypingIndicator();
  
  try {
    // Get answer from Dhiya
    const answer = await client.ask(query);
    
    // Display response
    addMessage('bot', answer.text, {
      confidence: answer.confidence,
      sources: answer.sources,
      timing: answer.timing
    });
  } catch (error) {
    console.error('Query failed:', error);
  }
}
```

**The Answer Object:**
```typescript
interface Answer {
  text: string;           // Generated answer
  sources: Source[];      // Retrieved sources
  confidence: number;     // Confidence score (0-1)
  chunks: SearchResult[]; // Raw search results
  provider?: LLMProvider; // Which LLM was used
  timing: TimingInfo;     // Performance metrics
}
```

### 5. Displaying Messages

```typescript
function addMessage(
  sender: 'user' | 'bot',
  text: string,
  metadata: { confidence?: number; sources?: any[]; timing?: any } | null
) {
  // Create message elements
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  // Add avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = sender === 'user' ? 'U' : '🤖';
  
  // Add content
  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = text;
  
  // Add metadata (confidence, sources, timing)
  if (sender === 'bot' && metadata) {
    if (metadata.confidence) {
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.textContent = `Confidence: ${(metadata.confidence * 100).toFixed(1)}%`;
      content.appendChild(meta);
    }
    
    if (metadata.sources && metadata.sources.length > 0) {
      const sourcesDiv = document.createElement('div');
      sourcesDiv.className = 'message-sources';
      sourcesDiv.innerHTML = '<strong>📚 Sources:</strong>';
      
      // Show top 3 sources
      metadata.sources.slice(0, 3).forEach((source: any) => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';
        sourceItem.innerHTML = `
          <span>${source.title || 'Source'}</span>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${source.similarity * 100}%"></div>
          </div>
        `;
        sourcesDiv.appendChild(sourceItem);
      });
      
      content.appendChild(sourcesDiv);
    }
  }
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  chatContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
```

## Customization

### Change Knowledge Base

Replace or modify the knowledge sources:

```typescript
const CUSTOM_KNOWLEDGE: KnowledgeSource = {
  type: 'json',
  data: [
    {
      title: 'Custom Topic 1',
      content: 'Your content here...'
    },
    {
      title: 'Custom Topic 2',
      content: 'More content...'
    }
  ]
};
```

### Modify UI Styles

All styles are in `index.html` within the `<style>` tag:

```css
/* Change primary color */
.btn-primary {
  background: #your-color;
}

/* Change chat bubble colors */
.user .message-content {
  background: #your-user-color;
}

.bot .message-content {
  background: #your-bot-color;
}
```

### Add File Upload

```typescript
// Add to HTML
<input type="file" id="fileInput" accept=".txt,.md,.json" />

// Add handler in main.ts
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const text = await file.text();
  
  await client.loadKnowledge({
    type: 'text',
    data: text
  });
});
```

### Persist Chat History

```typescript
// Save to localStorage
function saveChatHistory() {
  const messages = Array.from(chatContainer.children).map(msg => ({
    sender: msg.classList.contains('user') ? 'user' : 'bot',
    text: msg.querySelector('.message-content').textContent
  }));
  
  localStorage.setItem('chatHistory', JSON.stringify(messages));
}

// Load from localStorage
function loadChatHistory() {
  const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
  history.forEach(msg => addMessage(msg.sender, msg.text, null));
}
```

## Deployment

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### Deploy to GitHub Pages

1. Build the project: `npm run build`
2. Push `dist/` to `gh-pages` branch
3. Enable GitHub Pages in repository settings

## Troubleshooting

### Models Not Loading

**Problem:** Embedding models or LLMs fail to download

**Solutions:**
- Check internet connection
- Clear browser cache and IndexedDB
- Check browser console for specific errors
- Try different browser (Chrome works best)

### Slow Performance

**Problem:** Queries take too long

**Solutions:**
- Enable Chrome AI flags for faster inference
- Reduce knowledge base size
- Use shorter queries
- Close other browser tabs

### Out of Memory Errors

**Problem:** Browser crashes or shows out of memory errors

**Solutions:**
- Reduce chunk size: `chunkSize: 500` instead of 1000
- Load smaller knowledge bases
- Clear browser cache
- Increase browser memory limit

### TypeScript Errors

**Problem:** Import errors or type mismatches

**Solutions:**
- Rebuild package: `cd .. && npm run build`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript version: `npx tsc --version`

## Next Steps

Now that you understand the example, you can:

1. **Customize the UI** - Match your brand colors and style
2. **Add More Features** - File upload, export chat, voice input
3. **Integrate with Your App** - Use the React/Vue/Svelte wrappers
4. **Deploy to Production** - Host on Vercel, Netlify, or your server
5. **Scale Up** - Add more knowledge sources, implement feedback loops

## Resources

- [Dhiya Documentation](../README.md)
- [API Reference](../docs/API.md)
- [Transformers.js Docs](https://huggingface.co/docs/transformers.js)
- [Chrome AI APIs](https://developer.chrome.com/docs/ai)

## Get Help

- 🐛 [Report Issues](https://github.com/Xwits-Developers/dhiya-npm/issues)
- 💬 [Discussions](https://github.com/Xwits-Developers/dhiya-npm/discussions)
- 📧 Email: deep.parmar@sunbots.in

---

Happy building! 🚀
