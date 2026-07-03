/**
 * Packaging smoke test: verifies the built package actually loads through
 * its public entry points in Node ESM (which mirrors how bundlers, Vite SSR,
 * and CDNs resolve it). Run after `npm run build`.
 */
import assert from 'node:assert/strict';

// Main entry (self-reference resolves through the "exports" map)
const main = await import('dhiya-npm');
assert.equal(typeof main.DhiyaClient, 'function', 'DhiyaClient export missing');
assert.equal(typeof main.cosineSimilarity, 'function', 'cosineSimilarity export missing');
assert.equal(typeof main.chunkText, 'function', 'chunkText export missing');
assert.ok(main.LLMProvider.CHROME_AI, 'LLMProvider enum missing');
assert.ok(main.DEFAULT_CONFIG.chunkSize > 0, 'DEFAULT_CONFIG missing');

// Constructing a client must not throw outside the browser...
const client = new main.DhiyaClient({ enableLLM: false });
assert.ok(client, 'DhiyaClient construction failed');

// ...and initialize() must fail with a clear message, not a cryptic crash.
await assert.rejects(
  () => client.initialize(),
  /IndexedDB is not available/,
  'initialize() should explain that a browser environment is required'
);

// Widget entry must be importable in Node (SSR safety)
const widget = await import('dhiya-npm/widget');
assert.equal(typeof widget.DhiyaChatElement, 'function', 'DhiyaChatElement export missing');

// Chunker sanity: overlap near chunk size must terminate (regression guard)
const chunks = main.chunkText('word '.repeat(500), { chunkSize: 300, chunkOverlap: 290 });
assert.ok(chunks.length > 0 && chunks.length < 50, `chunker produced ${chunks.length} chunks`);

console.log('smoke-test: all entry points load correctly');
