"use client";

import { useEffect, useState } from 'react';
import { DhiyaClient, LLMProvider } from 'dhiya-npm';

const client = new DhiyaClient({
  enableLLM: false,
  preferredProvider: LLMProvider.TRANSFORMERS,
  transformersOptions: {
    model: 'Xenova/distilgpt2',
    temperature: 0.6,
    maxTokens: 180
  }
});

export default function Home() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [answer, setAnswer] = useState<string>('Initializing...');

  useEffect(() => {
    async function init() {
      try {
        await client.initialize();
        await client.loadKnowledge({
          type: 'text',
          documentId: 'nextjs-guide',
          content: [
            'Dhiya is a privacy-first RAG client that runs inside the browser.',
            'This Next.js demo loads Dhiya on the client and answers questions without any server calls.',
            'Use it to build secure support widgets and documentation portals.'
          ].join('\n')
        });
        setStatus('ready');
        setAnswer('Ask a question to see the answer...');
      } catch (error) {
        console.error(error);
        setStatus('error');
        setAnswer('Failed to initialize Dhiya. Check console for details.');
      }
    }

    init();
  }, []);

  async function handleAsk() {
    const result = await client.ask('How does client-side RAG help with privacy?');
    setAnswer(result.text);
  }

  return (
    <main style={{ padding: '3rem', fontFamily: 'system-ui', maxWidth: '760px', margin: '0 auto' }}>
      <h1>Dhiya + Next.js</h1>
      <p>
        This demo shows how to embed a <strong>client-side RAG</strong> experience inside a modern Next.js app. All embeddings, vector search, and LLM calls stay in the browser.
      </p>

      <button
        onClick={handleAsk}
        disabled={status !== 'ready'}
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '999px',
          border: 'none',
          background: '#111827',
          color: '#fff',
          cursor: status === 'ready' ? 'pointer' : 'not-allowed'
        }}
      >
        Ask why privacy matters
      </button>

      <section style={{ marginTop: '2rem', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem' }}>
        <h2>Answer</h2>
        <p>{answer}</p>
      </section>
    </main>
  );
}
