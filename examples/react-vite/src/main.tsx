import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DhiyaClient, LLMProvider } from 'dhiya-npm';

const client = new DhiyaClient({
  preferredProvider: LLMProvider.CHROME_AI,
  llmFallbackOrder: [LLMProvider.CHROME_AI, LLMProvider.TRANSFORMERS],
  // Force offline RAG for demo to avoid Chrome AI requirement
  chromeAIOptions: { temperature: 0.6, systemPrompt: 'You are a concise assistant.' },
  transformersOptions: { model: 'Xenova/distilgpt2' }
});

function App() {
  const [ready, setReady] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      await client.initialize();
      await client.loadKnowledge({
        type: 'array',
        documentId: 'react-demo',
        items: [
          'Dhiya is a client-side RAG client for the browser.',
          'It keeps embeddings, vector search, and LLM fallbacks fully on-device.',
          'Use it with React, Vite, and other modern front-end stacks.'
        ]
      });
      setReady(true);
    }

    bootstrap().catch((error) => {
      console.error('Failed to bootstrap Dhiya', error);
    });
  }, []);

  async function ask(question: string) {
    const result = await client.ask(question, { enableLLM: false });
    setAnswer(result.text);
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: '720px', margin: '0 auto' }}>
      <h1>Dhiya + React (Vite)</h1>
      <p>
        A minimal browser RAG client using <code>dhiya-npm</code>. All retrieval runs locally, making it a great fit for privacy-first chat widgets.
      </p>

      <button disabled={!ready} onClick={() => ask('Why is Dhiya privacy friendly?')}>
        Ask: Why is Dhiya privacy friendly?
      </button>

      <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <strong>Answer</strong>
        <p>{answer ?? (ready ? 'Ask a question to see an answer.' : 'Loading knowledge base…')}</p>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root container not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
