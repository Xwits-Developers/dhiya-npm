import { DhiyaClient } from 'dhiya-npm';
import 'dhiya-npm/widget';

const statusEl = document.getElementById('status')!;
const metaEl = document.getElementById('meta')!;
const kbEl = document.getElementById('kb') as HTMLTextAreaElement;
const loadBtn = document.getElementById('load') as HTMLButtonElement;
const askBtn = document.getElementById('ask') as HTMLButtonElement;
const qEl = document.getElementById('q') as HTMLInputElement;
const logEl = document.getElementById('chat-log')!;

// Add ?no-llm to the URL for a lightweight extractive-only session
const enableLLM = !new URLSearchParams(location.search).has('no-llm');

const client = new DhiyaClient({
  debug: true,
  enableLLM,
  onProgress: e => {
    statusEl.textContent = `${e.message}${e.progress !== undefined ? ` (${e.progress}%)` : ''}`;
  }
});

async function refreshMeta() {
  const status = await client.getStatus();
  metaEl.textContent =
    `embeddings: ${status.embedding.model} on ${status.embedding.device} · ` +
    `chunks: ${status.knowledgeBase.chunkCount} · ` +
    `LLM: ${status.llm.available ? status.llm.provider : status.llm.loading ? 'loading…' : 'unavailable (extractive mode)'}`;
}

function addMsg(role: 'user' | 'bot', text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  logEl.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

loadBtn.addEventListener('click', async () => {
  loadBtn.disabled = true;
  try {
    await client.loadKnowledge({ type: 'text', content: kbEl.value, documentId: 'demo-kb' });
    statusEl.textContent = 'Knowledge indexed ✔';
  } catch (err) {
    statusEl.textContent = `Indexing failed: ${err instanceof Error ? err.message : err}`;
  } finally {
    loadBtn.disabled = false;
    await refreshMeta();
  }
});

async function ask() {
  const query = qEl.value.trim();
  if (!query) return;
  qEl.value = '';
  askBtn.disabled = true;
  addMsg('user', query);
  const botEl = addMsg('bot', '…');

  let streamed = '';
  try {
    const answer = await client.ask(query, {
      onToken: token => {
        streamed += token;
        botEl.textContent = streamed;
      }
    });
    botEl.textContent = answer.text;
    if (answer.sources.length > 0) {
      const src = document.createElement('div');
      src.className = 'src';
      src.textContent =
        `confidence ${(answer.confidence * 100).toFixed(0)}% · ` +
        `${answer.timing.total}ms · provider: ${answer.provider ?? 'none'}`;
      botEl.appendChild(src);
    }
  } catch (err) {
    botEl.textContent = `Error: ${err instanceof Error ? err.message : err}`;
  } finally {
    askBtn.disabled = false;
    await refreshMeta();
  }
}

askBtn.addEventListener('click', () => void ask());
qEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') void ask();
});

// Expose for console experimentation
(window as any).dhiya = client;

// Boot
(async () => {
  await client.initialize();
  await refreshMeta();
  statusEl.textContent = 'Ready — index some knowledge, then ask away.';

  // The floating <dhiya-chat> widget can share the same client:
  const widget = document.createElement('dhiya-chat');
  widget.setAttribute('title', 'Dhiya widget');
  widget.setAttribute('welcome', 'Hi! I answer from the same knowledge base as the main demo.');
  document.body.appendChild(widget);
  (widget as any).client = client;
})();
