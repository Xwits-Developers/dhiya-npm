import { defineConfig } from 'vite';

export default defineConfig({
  // transformers.js ships its own WASM/worker assets; pre-bundling breaks
  // their URL resolution, so keep it out of optimizeDeps.
  optimizeDeps: {
    exclude: ['@huggingface/transformers']
  },
  server: {
    port: 5173
  }
});
