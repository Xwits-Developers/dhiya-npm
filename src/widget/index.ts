/**
 * <dhiya-chat> — a drop-in chat widget for the Dhiya client-side RAG engine.
 *
 * Zero-dependency custom element with shadow DOM. Two integration modes:
 *
 * 1. Declarative (one tag):
 *    <dhiya-chat kb-url="/help.txt" title="Support"></dhiya-chat>
 *    or inline knowledge:
 *    <dhiya-chat><script type="text/knowledge">...your docs...</script></dhiya-chat>
 *
 * 2. Programmatic:
 *    const widget = document.querySelector('dhiya-chat');
 *    widget.client = myDhiyaClient; // bring your own configured client
 *
 * Importing this module registers the element (side effect).
 */

import { DhiyaClient } from '../dhiya-client.js';
import { DhiyaConfig, ProgressEvent, ProgressType } from '../core/types.js';

const STYLES = `
:host {
  --dhiya-accent: #4f46e5;
  --dhiya-bg: #ffffff;
  --dhiya-text: #111827;
  --dhiya-muted: #6b7280;
  --dhiya-radius: 14px;
  all: initial;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: var(--dhiya-text);
}
* { box-sizing: border-box; }
.bubble {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--dhiya-accent);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 24px;
  box-shadow: 0 8px 24px rgba(0,0,0,.22);
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bubble:hover { filter: brightness(1.08); }
:host([position="left"]) .bubble, :host([position="left"]) .panel { right: auto; left: 20px; }
.panel {
  position: fixed;
  bottom: 88px;
  right: 20px;
  width: min(380px, calc(100vw - 32px));
  height: min(560px, calc(100vh - 120px));
  background: var(--dhiya-bg);
  border-radius: var(--dhiya-radius);
  box-shadow: 0 16px 48px rgba(0,0,0,.24);
  display: none;
  flex-direction: column;
  overflow: hidden;
  z-index: 2147483000;
}
.panel.open { display: flex; }
:host([inline]) .bubble { display: none; }
:host([inline]) .panel {
  position: static;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 420px;
  box-shadow: none;
  border: 1px solid #e5e7eb;
}
.header {
  background: var(--dhiya-accent);
  color: #fff;
  padding: 14px 16px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header button {
  background: none; border: none; color: #fff; cursor: pointer; font-size: 18px; line-height: 1;
}
:host([inline]) .header button { display: none; }
.status {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--dhiya-muted);
  border-bottom: 1px solid #f3f4f6;
  min-height: 25px;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.msg {
  max-width: 85%;
  padding: 10px 12px;
  border-radius: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.45;
}
.msg.user {
  align-self: flex-end;
  background: var(--dhiya-accent);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.msg.bot {
  align-self: flex-start;
  background: #f3f4f6;
  color: var(--dhiya-text);
  border-bottom-left-radius: 4px;
}
.msg.bot .sources {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #e5e7eb;
  font-size: 11px;
  color: var(--dhiya-muted);
}
.msg.bot.thinking::after {
  content: '···';
  animation: dhiya-pulse 1s infinite;
}
@keyframes dhiya-pulse { 50% { opacity: .35; } }
.inputrow {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #f3f4f6;
}
.inputrow input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 10px 12px;
  font: inherit;
  outline: none;
}
.inputrow input:focus { border-color: var(--dhiya-accent); }
.inputrow button {
  background: var(--dhiya-accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0 16px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.inputrow button:disabled { opacity: .5; cursor: default; }
`;

// SSR-safe base: importing this module in Node (e.g. during prerender)
// must not throw; the element is only registered where DOM APIs exist.
const BaseElement: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

export class DhiyaChatElement extends BaseElement {
  static get observedAttributes(): string[] {
    return ['title', 'placeholder', 'accent', 'welcome'];
  }

  private _client: DhiyaClient | null = null;
  private ownsClient = false;
  private ready = false;
  private busy = false;
  private root: ShadowRoot;
  private els: {
    panel?: HTMLElement;
    status?: HTMLElement;
    messages?: HTMLElement;
    input?: HTMLInputElement;
    send?: HTMLButtonElement;
    headerTitle?: HTMLElement;
  } = {};

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  /** Provide a pre-configured DhiyaClient. The widget will not create its own. */
  set client(client: DhiyaClient) {
    this._client = client;
    this.ownsClient = false;
    this.ready = true;
    this.setStatus('');
  }

  get client(): DhiyaClient | null {
    return this._client;
  }

  connectedCallback(): void {
    this.render();
    if (!this._client) {
      void this.bootstrap();
    }
  }

  attributeChangedCallback(): void {
    if (this.els.headerTitle) {
      this.els.headerTitle.textContent = this.getAttribute('title') || 'Ask me anything';
    }
    if (this.els.input) {
      this.els.input.placeholder = this.getAttribute('placeholder') || 'Type your question...';
    }
    const accent = this.getAttribute('accent');
    if (accent) {
      this.style.setProperty('--dhiya-accent', accent);
    }
  }

  disconnectedCallback(): void {
    if (this.ownsClient && this._client) {
      void this._client.destroy();
      this._client = null;
    }
  }

  private render(): void {
    const title = this.getAttribute('title') || 'Ask me anything';
    const placeholder = this.getAttribute('placeholder') || 'Type your question...';
    const accent = this.getAttribute('accent');
    if (accent) this.style.setProperty('--dhiya-accent', accent);

    this.root.innerHTML = `
      <style>${STYLES}</style>
      <button class="bubble" part="bubble" aria-label="Open chat">💬</button>
      <div class="panel" part="panel" role="dialog" aria-label="${title}">
        <div class="header"><span class="header-title"></span><button class="close" aria-label="Close chat">✕</button></div>
        <div class="status"></div>
        <div class="messages" role="log" aria-live="polite"></div>
        <div class="inputrow">
          <input type="text" placeholder="${placeholder}" aria-label="Your question" />
          <button class="send">Send</button>
        </div>
      </div>
    `;

    this.els = {
      panel: this.root.querySelector('.panel') as HTMLElement,
      status: this.root.querySelector('.status') as HTMLElement,
      messages: this.root.querySelector('.messages') as HTMLElement,
      input: this.root.querySelector('input') as HTMLInputElement,
      send: this.root.querySelector('.send') as HTMLButtonElement,
      headerTitle: this.root.querySelector('.header-title') as HTMLElement
    };
    this.els.headerTitle!.textContent = title;

    const bubble = this.root.querySelector('.bubble') as HTMLButtonElement;
    bubble.addEventListener('click', () => {
      this.els.panel!.classList.toggle('open');
      this.els.input!.focus();
    });
    (this.root.querySelector('.close') as HTMLButtonElement).addEventListener('click', () => {
      this.els.panel!.classList.remove('open');
    });

    const submit = () => void this.handleSubmit();
    this.els.send!.addEventListener('click', submit);
    this.els.input!.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });

    const welcome = this.getAttribute('welcome');
    if (welcome) {
      this.addMessage('bot', welcome);
    }
  }

  private async bootstrap(): Promise<void> {
    try {
      const config: DhiyaConfig = {
        enableLLM: !this.hasAttribute('no-llm'),
        onProgress: (event: ProgressEvent) => this.onProgress(event)
      };
      const dbName = this.getAttribute('db-name');
      if (dbName) config.dbName = dbName;

      this._client = new DhiyaClient(config);
      this.ownsClient = true;

      this.setStatus('Loading models...');
      await this._client.initialize();

      // Knowledge: kb-url attribute or an inline <script type="text/knowledge">
      const kbUrl = this.getAttribute('kb-url');
      const inlineKb = this.querySelector('script[type="text/knowledge"]')?.textContent?.trim();

      if (kbUrl) {
        this.setStatus('Loading knowledge...');
        const res = await fetch(kbUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${kbUrl}: HTTP ${res.status}`);
        const body = await res.text();
        const isJson = /\.json(\?|$)/.test(kbUrl) || (res.headers.get('content-type') || '').includes('json');
        await this._client.loadKnowledge(
          isJson
            ? { type: 'json', data: JSON.parse(body), documentId: kbUrl }
            : { type: 'text', content: body, documentId: kbUrl }
        );
      }
      if (inlineKb) {
        this.setStatus('Indexing knowledge...');
        await this._client.loadKnowledge({ type: 'text', content: inlineKb, documentId: 'inline' });
      }

      this.ready = true;
      this.setStatus('');
      this.dispatchEvent(new CustomEvent('dhiya-ready'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Error: ${message}`);
      this.dispatchEvent(new CustomEvent('dhiya-error', { detail: error }));
    }
  }

  private onProgress(event: ProgressEvent): void {
    if (this.ready) return;
    if (event.type === ProgressType.ERROR) return;
    const pct = event.progress !== undefined ? ` ${event.progress}%` : '';
    this.setStatus(`${event.message}${pct}`);
  }

  private setStatus(text: string): void {
    if (this.els.status) this.els.status.textContent = text;
  }

  private addMessage(role: 'user' | 'bot', text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.textContent = text;
    this.els.messages!.appendChild(el);
    this.els.messages!.scrollTop = this.els.messages!.scrollHeight;
    return el;
  }

  private async handleSubmit(): Promise<void> {
    const input = this.els.input!;
    const query = input.value.trim();
    if (!query || this.busy) return;

    if (!this._client || !this.ready) {
      this.setStatus('Still loading — one moment...');
      return;
    }

    input.value = '';
    this.busy = true;
    this.els.send!.disabled = true;
    this.addMessage('user', query);

    const botEl = this.addMessage('bot', '');
    botEl.classList.add('thinking');
    let streamed = '';

    try {
      const answer = await this._client.ask(query, {
        onToken: (token: string) => {
          botEl.classList.remove('thinking');
          streamed += token;
          botEl.textContent = streamed;
          this.els.messages!.scrollTop = this.els.messages!.scrollHeight;
        }
      });

      botEl.classList.remove('thinking');
      botEl.textContent = answer.text;

      if (answer.sources.length > 0 && !this.hasAttribute('hide-sources')) {
        const sources = document.createElement('div');
        sources.className = 'sources';
        sources.textContent = `Sources: ${answer.sources
          .slice(0, 3)
          .map(s => s.title || s.id)
          .join(', ')}`;
        botEl.appendChild(sources);
      }

      this.dispatchEvent(new CustomEvent('dhiya-answer', { detail: answer }));
    } catch (error) {
      botEl.classList.remove('thinking');
      const message = error instanceof Error ? error.message : String(error);
      botEl.textContent = `Sorry, something went wrong: ${message}`;
    } finally {
      this.busy = false;
      this.els.send!.disabled = false;
      this.els.messages!.scrollTop = this.els.messages!.scrollHeight;
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('dhiya-chat')) {
  customElements.define('dhiya-chat', DhiyaChatElement);
}

export { DhiyaClient };
