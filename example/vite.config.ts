import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext'
  },
  optimizeDeps: {
    // Let Vite pre-bundle transformers for consistent module graph
    esbuildOptions: {
      target: 'esnext'
    }
  },
  define: {
    // Some libraries reference process.env (harmless in browser)
    'process.env': {}
  },
  worker: {
    format: 'es'
  }
});
