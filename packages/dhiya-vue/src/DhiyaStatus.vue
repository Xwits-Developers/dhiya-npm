<template>
  <div :class="`dhiya-status ${className}`">
    <div v-if="loading" class="dhiya-status-loading">
      Loading...
    </div>
    <template v-else-if="initialized && status">
      <div class="dhiya-status-item">
        <span>Embeddings:</span>
        <span :class="status.embedding.ready ? 'status-ready' : 'status-loading'">
          {{ status.embedding.ready ? '✅ Ready' : '⏳ Loading' }}
        </span>
      </div>
      <div class="dhiya-status-item">
        <span>LLM:</span>
        <span :class="status.llm.available ? 'status-ready' : 'status-unavailable'">
          {{ status.llm.available ? `✅ ${status.llm.provider}` : '❌ Unavailable' }}
        </span>
      </div>
      <div class="dhiya-status-item">
        <span>Knowledge Base:</span>
        <span>{{ status.knowledgeBase.chunkCount }} chunks</span>
      </div>
    </template>
    <div v-else class="dhiya-status-loading">
      Not initialized
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRAG, UseRAGOptions } from './useRAG';

interface Props {
  config?: UseRAGOptions;
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  className: ''
});

const { status, initialized, loading } = useRAG(props.config);
</script>
