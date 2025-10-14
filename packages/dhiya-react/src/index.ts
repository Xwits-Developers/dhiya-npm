/**
 * @dhiya/react - React bindings for Dhiya
 */

export { useRAG } from './useRAG';
export type { UseRAGOptions, UseRAGReturn } from './useRAG';

export { DhiyaChat, DhiyaStatus } from './components';
export type { ChatMessage, DhiyaChatProps, DhiyaStatusProps } from './components';

// Re-export common types from dhiya-npm
export type {
  DhiyaConfig,
  Answer,
  KnowledgeSource,
  ClientStatus,
  ProgressEvent
} from 'dhiya-npm';
