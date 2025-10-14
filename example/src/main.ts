/**
 * Dhiya Chatbot Example
 * Demonstrates the dhiya-npm package usage
 */

// IMPORTANT: Import config FIRST to configure Transformers.js env
import { configureTransformers } from './config';
import { DhiyaClient, KnowledgeSource } from 'dhiya-npm';

// Sample knowledge bases
const AI_KNOWLEDGE: KnowledgeSource = {
  type: 'json',
  data: [
    {
      title: 'Machine Learning',
      content: 'Machine Learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing computer programs that can access data and use it to learn for themselves. The learning process begins with observations or data, such as examples, direct experience, or instruction, in order to look for patterns in data and make better decisions in the future.'
    },
    {
      title: 'Deep Learning',
      content: 'Deep Learning is a subset of machine learning that uses neural networks with multiple layers (deep neural networks) to learn complex patterns in large amounts of data. It mimics the way human brains work to process information. Deep learning models can automatically learn representations from data such as images, video, or text, without introducing hand-coded rules or human domain knowledge.'
    },
    {
      title: 'Natural Language Processing',
      content: 'Natural Language Processing (NLP) is a branch of artificial intelligence that helps computers understand, interpret and manipulate human language. NLP draws from many disciplines, including computer science and computational linguistics, to bridge the gap between human communication and computer understanding. Common NLP tasks include text classification, sentiment analysis, machine translation, and question answering.'
    },
    {
      title: 'Neural Networks',
      content: 'Neural Networks are computing systems inspired by the biological neural networks that constitute animal brains. They consist of interconnected nodes (artificial neurons) organized in layers. Each connection can transmit a signal from one artificial neuron to another. The receiving neuron processes the signal and signals downstream neurons connected to it. Neural networks are used in various applications including image recognition, speech recognition, and natural language processing.'
    },
    {
      title: 'Transformers',
      content: 'Transformers are a type of neural network architecture that has revolutionized natural language processing. Introduced in the "Attention is All You Need" paper, transformers use self-attention mechanisms to process sequential data in parallel, making them much more efficient than previous architectures like RNNs. Modern language models like GPT, BERT, and T5 are all based on the transformer architecture.'
    },
    {
      title: 'RAG (Retrieval-Augmented Generation)',
      content: 'RAG is a technique that enhances language models by combining retrieval-based and generation-based approaches. It first retrieves relevant documents from a knowledge base using semantic search, then uses those documents as context for generating responses. This approach helps reduce hallucinations and provides more factual, grounded answers compared to purely generative models.'
    }
  ]
};

const COMPANY_KNOWLEDGE: KnowledgeSource = {
  type: 'json',
  data: [
    {
      title: 'Company Overview',
      content: 'TechCorp is a leading technology company founded in 2020, specializing in artificial intelligence and machine learning solutions. We have offices in San Francisco, London, and Tokyo, with over 500 employees worldwide. Our mission is to make AI accessible to businesses of all sizes through innovative, user-friendly products.'
    },
    {
      title: 'Products',
      content: 'Our flagship product is Dhiya, a client-side RAG framework that runs entirely in the browser. We also offer CloudML, an enterprise machine learning platform, and DataViz Pro, an advanced data visualization toolkit. All our products are designed with privacy and performance in mind.'
    },
    {
      title: 'Support Hours',
      content: 'Our customer support team is available Monday through Friday, 9 AM to 6 PM PST. For enterprise customers, we offer 24/7 premium support. You can reach us via email at support@techcorp.com, through our live chat, or by calling +1-555-TECH-HELP.'
    },
    {
      title: 'Pricing',
      content: 'We offer three pricing tiers: Free (for individuals and small projects), Professional ($49/month for small teams), and Enterprise (custom pricing for large organizations). All plans include core features, with higher tiers offering advanced capabilities, priority support, and dedicated account management.'
    }
  ]
};

// DOM Elements
const statusDot = document.getElementById('statusDot') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLSpanElement;
const chunkCount = document.getElementById('chunkCount') as HTMLSpanElement;
const modelName = document.getElementById('modelName') as HTMLSpanElement;
const singleModeToggle = document.getElementById('singleModeToggle') as HTMLInputElement | null;
const chatContainer = document.getElementById('chatContainer') as HTMLDivElement;
const queryInput = document.getElementById('queryInput') as HTMLInputElement;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
const loadAIBtn = document.getElementById('loadAIBtn') as HTMLButtonElement;
const loadCompanyBtn = document.getElementById('loadCompanyBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
// Custom ingestion controls
const loadTextBtn = document.getElementById('loadTextBtn') as HTMLButtonElement | null;
const loadJSONBtn = document.getElementById('loadJSONBtn') as HTMLButtonElement | null;
const loadArrayBtn = document.getElementById('loadArrayBtn') as HTMLButtonElement | null;
const loadURLBtn = document.getElementById('loadURLBtn') as HTMLButtonElement | null;
const loadFileBtn = document.getElementById('loadFileBtn') as HTMLButtonElement | null;
const customInputs = document.getElementById('customInputs') as HTMLDivElement | null;
const textInput = document.getElementById('textInput') as HTMLTextAreaElement | null;
const jsonInput = document.getElementById('jsonInput') as HTMLTextAreaElement | null;
const urlInput = document.getElementById('urlInput') as HTMLInputElement | null;
const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
const ingestBtn = document.getElementById('ingestBtn') as HTMLButtonElement | null;
const cancelIngestBtn = document.getElementById('cancelIngestBtn') as HTMLButtonElement | null;
const ingestStatus = document.getElementById('ingestStatus') as HTMLDivElement | null;

const GLOSSARY_KNOWLEDGE: KnowledgeSource = {
  type: 'array',
  items: [
    'Embedding: Vector representation of text capturing semantic meaning.',
    'Chunk: A segment of original content split for efficient retrieval.',
    'RAG: Retrieval Augmented Generation, combining search + generation.'
  ],
  documentId: 'glossary'
};

// Initialize Dhiya client
let client: DhiyaClient;

async function initialize() {
  try {
    statusText.textContent = 'Configuring environment...';
    
    // Configure Transformers.js and ONNX Runtime first
    await configureTransformers();
    
    statusText.textContent = 'Initializing Dhiya...';
    
    client = new DhiyaClient({
      debug: true,
      enableLLM: true, // Enable LLM fallback
    });

    await client.initialize();

    statusDot.classList.remove('loading');
    statusText.textContent = 'Ready';
    
    // Update status
    await updateStatus();

    // Enable input
    queryInput.disabled = false;
    sendBtn.disabled = false;
    loadAIBtn.disabled = false;
    loadCompanyBtn.disabled = false;
    clearBtn.disabled = false;

    console.log('✅ Dhiya initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize:', error);
    statusText.textContent = 'Initialization failed';
    addMessage('bot', 'Sorry, failed to initialize the chatbot. Please refresh the page.', null);
  }
}

async function updateStatus() {
  const status = await client.getStatus();
  chunkCount.textContent = status.knowledgeBase.chunkCount.toString();
  
  if (status.llm.available && status.llm.provider) {
    modelName.textContent = status.llm.provider;
  } else {
    modelName.textContent = 'Fallback Mode';
  }
}

async function loadKnowledge(source: KnowledgeSource, name: string) {
  const btn = name === 'AI' ? loadAIBtn : loadCompanyBtn;
  const originalText = btn.textContent;
  
  try {
    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div> Loading...';
    
    await client.loadKnowledge(source);
    await updateStatus();
    
    addMessage('bot', `✅ Successfully loaded ${name} knowledge base!`, null);
    
    // Clear empty state if present
    const emptyState = chatContainer.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }
  } catch (error) {
    console.error('Failed to load knowledge:', error);
    addMessage('bot', `❌ Failed to load ${name} knowledge base.`, null);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function clearKnowledge() {
  try {
    clearBtn.disabled = true;
    await client.clear();
    await updateStatus();
    
    chatContainer.innerHTML = `
      <div class="empty-state">
        <h3>✨ Knowledge base cleared</h3>
        <p>Load a new knowledge base to start asking questions.</p>
      </div>
    `;
  } catch (error) {
    console.error('Failed to clear knowledge:', error);
  } finally {
    clearBtn.disabled = false;
  }
}

function addMessage(
  sender: 'user' | 'bot',
  text: string,
  metadata: { confidence?: number; sources?: any[]; timing?: any } | null
) {
  // Remove empty state if present
  const emptyState = chatContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = sender === 'user' ? 'U' : '🤖';

  const contentWrapper = document.createElement('div');
  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = text;

  // Add metadata for bot messages
  if (sender === 'bot' && metadata) {
    if (metadata.confidence !== undefined) {
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.textContent = `Confidence: ${(metadata.confidence * 100).toFixed(1)}%`;
      content.appendChild(meta);
    }

    if (metadata.sources && metadata.sources.length > 0) {
      const useSingle = singleModeToggle?.checked;
      const sourcesDiv = document.createElement('div');
      sourcesDiv.className = 'message-sources';
      sourcesDiv.innerHTML = '<strong>📚 Sources:</strong>';
      const slice = useSingle ? metadata.sources.slice(0,1) : metadata.sources.slice(0,3);
      slice.forEach((source: any) => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';
        const sourceText = document.createElement('span');
        sourceText.textContent = source.title || 'Source';
        const confidenceBar = document.createElement('div');
        confidenceBar.className = 'confidence-bar';
        const confidenceFill = document.createElement('div');
        confidenceFill.className = 'confidence-fill';
        confidenceFill.style.width = `${(source.similarity || source.score || 0) * 100}%`;
        confidenceBar.appendChild(confidenceFill);
        sourceItem.appendChild(sourceText);
        sourceItem.appendChild(confidenceBar);
        sourcesDiv.appendChild(sourceItem);
      });
      content.appendChild(sourcesDiv);
    }

    if (metadata.timing) {
      const timingMeta = document.createElement('div');
      timingMeta.className = 'message-meta';
      timingMeta.textContent = `⚡ ${metadata.timing.total}ms (retrieval: ${metadata.timing.retrieval}ms)`;
      content.appendChild(timingMeta);
    }
  }

  contentWrapper.appendChild(content);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentWrapper);

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot';
  typingDiv.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '🤖';

  const content = document.createElement('div');
  content.className = 'message-content';
  
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  
  content.appendChild(indicator);
  typingDiv.appendChild(avatar);
  typingDiv.appendChild(content);

  chatContainer.appendChild(typingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

async function handleQuery() {
  const query = queryInput.value.trim();
  if (!query) return;

  // Add user message
  addMessage('user', query, null);
  queryInput.value = '';

  // Show typing indicator
  showTypingIndicator();

  // Disable input while processing
  queryInput.disabled = true;
  sendBtn.disabled = true;

  try {
    const answer = await client.ask(query);
    
    removeTypingIndicator();
    
  // If single answer mode show only topSource (API sets sources to one when enabled, but we handle toggle live)
  const sourcesForDisplay = singleModeToggle?.checked && (answer as any).topSource ? [ (answer as any).topSource ] : (answer.sources || []);
  addMessage('bot', answer.text, { confidence: answer.confidence, sources: sourcesForDisplay, timing: answer.timing });
  } catch (error) {
    console.error('Query failed:', error);
    removeTypingIndicator();
    addMessage('bot', 'Sorry, I encountered an error processing your question.', null);
  } finally {
    queryInput.disabled = false;
    sendBtn.disabled = false;
    queryInput.focus();
  }
}

// Event listeners
loadAIBtn.addEventListener('click', () => loadKnowledge(AI_KNOWLEDGE, 'AI'));
loadCompanyBtn.addEventListener('click', () => loadKnowledge(COMPANY_KNOWLEDGE, 'Company'));
clearBtn.addEventListener('click', clearKnowledge);
sendBtn.addEventListener('click', handleQuery);
queryInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !queryInput.disabled) {
    handleQuery();
  }
});

// ================= Custom Knowledge Ingestion =================
function showInputMode(mode: 'text' | 'json' | 'url' | 'file') {
  if (!customInputs) return;
  customInputs.style.display = 'block';
  if (textInput) textInput.style.display = mode === 'text' ? 'block' : 'none';
  if (jsonInput) jsonInput.style.display = mode === 'json' ? 'block' : 'none';
  if (urlInput) urlInput.style.display = mode === 'url' ? 'block' : 'none';
  if (fileInput) fileInput.style.display = mode === 'file' ? 'block' : 'none';
  if (ingestStatus) ingestStatus.textContent = '';
  if (textInput && mode !== 'text') textInput.value = '';
  if (jsonInput && mode !== 'json') jsonInput.value = '';
  if (urlInput && mode !== 'url') urlInput.value = '';
  if (fileInput && mode !== 'file') fileInput.value = '';
  if (ingestBtn) (ingestBtn as any).dataset.mode = mode;
}

loadTextBtn?.addEventListener('click', () => showInputMode('text'));
loadJSONBtn?.addEventListener('click', () => showInputMode('json'));
loadArrayBtn?.addEventListener('click', async () => { await loadKnowledge(GLOSSARY_KNOWLEDGE, 'Glossary'); });
loadURLBtn?.addEventListener('click', () => showInputMode('url'));
loadFileBtn?.addEventListener('click', () => showInputMode('file'));
cancelIngestBtn?.addEventListener('click', () => { if (customInputs) customInputs.style.display = 'none'; });

ingestBtn?.addEventListener('click', async () => {
  if (!client || !ingestBtn) return;
  const mode = (ingestBtn as any).dataset.mode as string;
  ingestBtn.disabled = true;
  if (ingestStatus) ingestStatus.textContent = 'Ingesting...';
  try {
    let source: KnowledgeSource | null = null;
    if (mode === 'text') {
      if (!textInput?.value.trim()) throw new Error('Enter text.');
      source = { type: 'text', content: textInput.value.trim(), documentId: `text-${Date.now()}` };
    } else if (mode === 'json') {
      if (!jsonInput?.value.trim()) throw new Error('Enter JSON.');
      let parsed; try { parsed = JSON.parse(jsonInput.value); } catch { throw new Error('Invalid JSON'); }
      source = { type: 'json', data: parsed, documentId: `json-${Date.now()}` };
    } else if (mode === 'url') {
      if (!urlInput?.value.trim()) throw new Error('Enter URL.');
      source = { type: 'url', url: urlInput.value.trim(), documentId: `url-${Date.now()}` } as any;
    } else if (mode === 'file') {
      if (!fileInput?.files || fileInput.files.length === 0) throw new Error('Select a file.');
      const file = fileInput.files[0];
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        try { const json = JSON.parse(text); source = { type: 'json', data: json, documentId: `filejson-${Date.now()}` }; }
        catch { source = { type: 'text', content: text, documentId: `filetxt-${Date.now()}` }; }
      } else {
        source = { type: 'text', content: text, documentId: `filetxt-${Date.now()}` };
      }
    }
    if (!source) throw new Error('Unsupported mode');
    await loadKnowledge(source, source.type.toUpperCase());
    if (ingestStatus) ingestStatus.textContent = '✅ Ingested successfully';
  } catch (err) {
    if (ingestStatus) ingestStatus.textContent = '❌ ' + (err instanceof Error ? err.message : 'Failed');
  } finally {
    if (ingestBtn) ingestBtn.disabled = false;
  }
});

// Initialize on load
initialize();

// Wire toggle to runtime config switch
singleModeToggle?.addEventListener('change', () => {
  if (!client) return;
  (client as any).config.singleAnswerMode = singleModeToggle.checked;
});
