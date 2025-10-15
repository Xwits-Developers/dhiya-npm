# Dhiya Next.js Example

A minimal Next.js 14 application that depends on [`dhiya-npm`](https://www.npmjs.com/package/dhiya-npm) to deliver a browser-only RAG workflow.

## Quick Start

```bash
npm install
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000) and click the call-to-action. The page loads `DhiyaClient` directly in the browser, indexes a small knowledge base, and answers a canned privacy question.

## Highlights

- Uses the Next.js App Router (client component) with `DhiyaClient`
- Keeps embeddings, vector search, and optional LLM fallback on-device
- Demonstrates how to integrate Dhiya into modern frameworks without custom API routes

Use this template as the starting point for support widgets, documentation assistants, or intranet search tools built on top of Dhiya.
