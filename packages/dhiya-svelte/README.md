# @dhiya/svelte

Svelte bindings for [Dhiya](https://github.com/Xwits-Developers/dhiya-npm) - Client-side RAG framework.

## Installation

```bash
npm install @dhiya/svelte dhiya-npm
```

## Quick Start

### Using Stores

```svelte
<script>
  import { onMount } from 'svelte';
  import { createRAGStores } from '@dhiya/svelte';
  
  const { initialized, loading, ask, loadKnowledge, lastAnswer } = createRAGStores({
    autoInitialize: true,
    debug: true,
    enableLLM: true
  });
  
  onMount(async () => {
    if ($initialized) {
      await loadKnowledge({
        type: 'json',
        data: [{ title: 'Hello', content: 'World' }]
      });
    }
  });
  
  async function handleAsk() {
    const answer = await ask('What is this about?');
    console.log($lastAnswer.text);
  }
</script>

{#if $loading}
  <div>Loading...</div>
{:else}
  <button on:click={handleAsk}>Ask Question</button>
  {#if $lastAnswer}
    <p>{$lastAnswer.text}</p>
  {/if}
{/if}
```

### Using Components

```svelte
<script>
  import { DhiyaChat, DhiyaStatus } from '@dhiya/svelte';
</script>

<DhiyaStatus />
<DhiyaChat
  config={{ debug: true, enableLLM: true }}
  placeholder="Ask anything..."
/>
```

## API

### `createRAGStores(options)`

Factory function that creates Svelte stores for Dhiya client.

**Returns:**
- `client`: Writable<DhiyaClient> instance
- `status`: Writable<ClientStatus> current status
- `initialized`: Writable<boolean> ready state
- `loading`: Writable<boolean> operation in progress
- `error`: Writable<Error | null> last error
- `progress`: Writable<ProgressEvent> operation progress
- `lastAnswer`: Writable<Answer> last generated answer
- `isAsking`: Writable<boolean> processing query
- `isReady`: Readable<boolean> derived ready state
- `initialize()`: Manually initialize
- `loadKnowledge(source)`: Load knowledge
- `ask(query, options)`: Ask a question
- `clear()`: Clear knowledge base
- `destroy()`: Cleanup resources

### `<DhiyaChat>`

Pre-built chat interface component.

**Props:**
- `config`: Dhiya configuration
- `className`: Custom CSS class
- `placeholder`: Input placeholder text

### `<DhiyaStatus>`

Status display component.

**Props:**
- `config`: Dhiya configuration
- `className`: Custom CSS class

## License

MIT © Deep Parmar
