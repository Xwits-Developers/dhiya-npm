/**
 * Advanced Example: Using Dhiya with custom configuration
 */

import { DhiyaClient, ProgressType } from '../dist/index.js';

// Advanced configuration
const client = new DhiyaClient({
  dbName: 'my-advanced-kb',
  embeddingModel: 'english',
  device: 'auto',
  chunkSize: 1000,
  chunkOverlap: 150,
  topK: 10,
  similarityThreshold: 0.3,
  useDiversity: true,
  cacheTTL: 48 * 60 * 60 * 1000, // 48 hours
  maxCacheSize: 200,
  debug: true,
  onProgress: (event) => {
    console.log(`📊 [${event.type}] ${event.message}`, event.progress);
  },
  onError: (error) => {
    console.error('❌ Error:', error);
  }
});

// Example 1: Load from JSON
async function loadFromJSON() {
  console.log('\n=== Example 1: Load from JSON ===\n');
  
  await client.loadKnowledge({
    type: 'json',
    documentId: 'company-info',
    data: {
      doc_id: 'company',
      entries: [
        {
          id: 'about',
          title: 'About Us',
          content: 'We are a technology company focused on AI and machine learning solutions.'
        },
        {
          id: 'products',
          title: 'Products',
          content: 'Our main products include: 1) AI Assistant Platform, 2) ML Model Training Tools, 3) Data Analytics Suite.'
        }
      ]
    }
  });
}

// Example 2: Load from text
async function loadFromText() {
  console.log('\n=== Example 2: Load from Text ===\n');
  
  await client.loadKnowledge({
    type: 'text',
    documentId: 'docs',
    content: `
      # API Documentation
      
      ## Authentication
      All API requests require an API key in the header: X-API-Key.
      
      ## Endpoints
      
      ### GET /api/search
      Search the knowledge base with semantic search.
      
      Parameters:
      - query (string): Search query
      - topK (number): Number of results (default: 5)
      
      Returns: Array of search results with similarity scores.
    `,
    metadata: {
      category: 'documentation',
      version: '1.0'
    }
  });
}

// Example 3: Load from array
async function loadFromArray() {
  console.log('\n=== Example 3: Load from Array ===\n');
  
  await client.loadKnowledge({
    type: 'array',
    documentId: 'faqs',
    items: [
      'Q: What is RAG? A: RAG stands for Retrieval-Augmented Generation, a technique that combines document retrieval with language models.',
      'Q: Is Dhiya free? A: Yes, Dhiya is open-source and free to use.',
      'Q: What browsers are supported? A: All modern browsers with IndexedDB and WebAssembly support.',
      'Q: Can I use custom models? A: Yes, you can configure custom embedding models and LLMs.'
    ]
  });
}

// Example 4: Ask questions
async function askQuestions() {
  console.log('\n=== Example 4: Ask Questions ===\n');
  
  const questions = [
    'What products do you offer?',
    'How do I authenticate with the API?',
    'What is RAG?',
    'Tell me about your company'
  ];
  
  for (const question of questions) {
    console.log(`\n❓ Question: ${question}`);
    
    try {
      const answer = await client.ask(question, {
        topK: 5
      });
      
      console.log(`✅ Answer: ${answer.text}`);
      console.log(`📊 Confidence: ${(answer.confidence * 100).toFixed(1)}%`);
      console.log(`⏱️  Time: ${answer.timing.total}ms`);
      console.log(`📚 Sources: ${answer.sources.length}`);
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 5: Monitor status
async function monitorStatus() {
  console.log('\n=== Example 5: System Status ===\n');
  
  const status = await client.getStatus();
  
  console.log('System Status:');
  console.log(`  Initialized: ${status.initialized}`);
  console.log(`  Embedding Model: ${status.embedding.model}`);
  console.log(`  Device: ${status.embedding.device}`);
  console.log(`  Chunks: ${status.knowledgeBase.chunkCount}`);
  console.log(`  Documents: ${status.knowledgeBase.documentCount}`);
  console.log(`  Cache Size: ${status.storage.cacheSize}`);
}

// Example 6: Clear and reload
async function clearAndReload() {
  console.log('\n=== Example 6: Clear and Reload ===\n');
  
  console.log('Clearing knowledge base...');
  await client.clear();
  
  const statusAfterClear = await client.getStatus();
  console.log(`Chunks after clear: ${statusAfterClear.knowledgeBase.chunkCount}`);
  
  console.log('Reloading...');
  await loadFromJSON();
  
  const statusAfterReload = await client.getStatus();
  console.log(`Chunks after reload: ${statusAfterReload.knowledgeBase.chunkCount}`);
}

// Main execution
async function main() {
  try {
    console.log('🚀 Initializing Dhiya...');
    await client.initialize();
    console.log('✅ Dhiya initialized!');
    
    // Run examples
    await loadFromJSON();
    await loadFromText();
    await loadFromArray();
    await monitorStatus();
    await askQuestions();
    await clearAndReload();
    
    console.log('\n✅ All examples completed!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    // Cleanup
    await client.destroy();
    console.log('\n👋 Cleanup complete');
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { client, main };
