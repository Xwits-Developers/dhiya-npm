/**
 * @dhiya/vue - Vue 3 bindings for Dhiya
 */

export { useRAG } from './useRAG';
export type { UseRAGOptions, UseRAGReturn } from './useRAG';

export { default as DhiyaChat } from './DhiyaChat.vue';
export { default as DhiyaStatus } from './DhiyaStatus.vue';

// Re-export common types from dhiya-npm
export type {
  DhiyaConfig,
  Answer,
  KnowledgeSource,
  ClientStatus,
  ProgressEvent
} from 'dhiya-npm';
