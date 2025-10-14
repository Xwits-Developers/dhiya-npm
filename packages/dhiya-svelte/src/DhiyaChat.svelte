<script lang="ts">
  import { onMount } from 'svelte';
  import { createRAGStores, type CreateRAGStoresOptions } from './stores';
  import type { Answer } from 'dhiya-npm';
  
  export let config: CreateRAGStoresOptions = {};
  export let className: string = '';
  export let placeholder: string = 'Ask me anything...';
  
  interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    answer?: Answer;
  }
  
  const { initialized, loading, ask, isAsking } = createRAGStores({
    autoInitialize: true,
    ...config
  });
  
  let messages: ChatMessage[] = [
    {
      id: '0',
      role: 'assistant',
      content: '👋 Hi! I\'m here to help. What would you like to know?',
      timestamp: Date.now()
    }
  ];
  
  let input = '';
  let messagesContainer: HTMLElement;
  
  function scrollToBottom() {
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 0);
    }
  }
  
  async function handleSubmit() {
    if (!input.trim() || $isAsking || !$initialized) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    
    messages = [...messages, userMessage];
    const queryText = input;
    input = '';
    scrollToBottom();
    
    try {
      // Get answer
      const answer = await ask(queryText);
      
      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer.text,
        timestamp: Date.now(),
        answer
      };
      
      messages = [...messages, assistantMessage];
      scrollToBottom();
      
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      messages = [...messages, errorMessage];
      scrollToBottom();
    }
  }
</script>

<div class="dhiya-chat {className}">
  {#if $loading}
    <div class="dhiya-loading">Loading Dhiya...</div>
  {:else}
    <div class="dhiya-messages" bind:this={messagesContainer}>
      {#each messages as msg (msg.id)}
        <div class="dhiya-message dhiya-message-{msg.role}">
          <div class="dhiya-message-content">{msg.content}</div>
          {#if msg.answer}
            <div class="dhiya-message-meta">
              <small>
                {(msg.answer.confidence * 100).toFixed(0)}% confidence
                {#if msg.answer.provider}
                  • {msg.answer.provider}
                {/if}
                • {msg.answer.timing.total}ms
              </small>
            </div>
          {/if}
        </div>
      {/each}
      {#if $isAsking}
        <div class="dhiya-message dhiya-message-assistant">
          <div class="dhiya-thinking">💭 Thinking...</div>
        </div>
      {/if}
    </div>
    
    <form class="dhiya-input-form" on:submit|preventDefault={handleSubmit}>
      <input
        bind:value={input}
        type="text"
        {placeholder}
        disabled={$isAsking || !$initialized}
        class="dhiya-input"
      />
      <button
        type="submit"
        disabled={$isAsking || !$initialized || !input.trim()}
        class="dhiya-button"
      >
        Send
      </button>
    </form>
  {/if}
</div>
