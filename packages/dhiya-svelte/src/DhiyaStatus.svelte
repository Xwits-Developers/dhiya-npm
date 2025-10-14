<script lang="ts">
  import { createRAGStores, type CreateRAGStoresOptions } from './stores';
  
  export let config: CreateRAGStoresOptions = {};
  export let className: string = '';
  
  const { status, initialized, loading } = createRAGStores({
    autoInitialize: true,
    ...config
  });
</script>

<div class="dhiya-status {className}">
  {#if $loading}
    <div class="dhiya-status-loading">Loading...</div>
  {:else if $initialized && $status}
    <div class="dhiya-status-item">
      <span>Embeddings:</span>
      <span class:status-ready={$status.embedding.ready} class:status-loading={!$status.embedding.ready}>
        {$status.embedding.ready ? '✅ Ready' : '⏳ Loading'}
      </span>
    </div>
    <div class="dhiya-status-item">
      <span>LLM:</span>
      <span class:status-ready={$status.llm.available} class:status-unavailable={!$status.llm.available}>
        {$status.llm.available ? `✅ ${$status.llm.provider}` : '❌ Unavailable'}
      </span>
    </div>
    <div class="dhiya-status-item">
      <span>Knowledge Base:</span>
      <span>{$status.knowledgeBase.chunkCount} chunks</span>
    </div>
  {:else}
    <div class="dhiya-status-loading">Not initialized</div>
  {/if}
</div>
