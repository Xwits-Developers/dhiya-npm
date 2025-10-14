/**
 * @dhiya/svelte - Svelte bindings for Dhiya
 */

export { createRAGStores } from './stores';
export type { RAGStores, CreateRAGStoresOptions } from './stores';

export { default as DhiyaChat } from './DhiyaChat.svelte';
export { default as DhiyaStatus } from './DhiyaStatus.svelte';

// Re-export common types from dhiya-npm
export type {
  DhiyaConfig,
  Answer,
  KnowledgeSource,
  ClientStatus,
  ProgressEvent
} from 'dhiya-npm';
