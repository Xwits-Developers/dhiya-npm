# @dhiya/vue

Vue 3 bindings for [Dhiya](https://github.com/Xwits-Developers/dhiya-npm) - Client-side RAG framework.

## Installation

```bash
npm install @dhiya/vue dhiya-npm
```

## Quick Start

### Using the Composable

```vue
<script setup>
import { useRAG } from '@dhiya/vue';
import { onMounted } from 'vue';

const { initialized, loading, ask, loadKnowledge } = useRAG({
  debug: true,
  enableLLM: true
});

onMounted(async () => {
  if (initialized.value) {
    await loadKnowledge({
      type: 'json',
      data: [{ title: 'Hello', content: 'World' }]
    });
  }
});

const handleAsk = async () => {
  const answer = await ask('What is this about?');
  console.log(answer.text);
};
</script>

<template>
  <div>
    <div v-if="loading">Loading...</div>
    <button v-else @click="handleAsk">Ask Question</button>
  </div>
</template>
```

### Using Components

```vue
<script setup>
import { DhiyaChat, DhiyaStatus } from '@dhiya/vue';

const handleMessage = (msg) => {
  console.log('New message:', msg);
};
</script>

<template>
  <div>
    <DhiyaStatus />
    <DhiyaChat
      :config="{ debug: true, enableLLM: true }"
      @message="handleMessage"
      placeholder="Ask anything..."
    />
  </div>
</template>
```

## API

### `useRAG(options)`

Composable that manages Dhiya client lifecycle.

**Returns:**
- `client`: Ref<DhiyaClient> instance
- `status`: Ref<ClientStatus> current status
- `initialized`: Ref<boolean> ready state
- `loading`: Ref<boolean> operation in progress
- `error`: Ref<Error | null> last error
- `progress`: Ref<ProgressEvent> operation progress
- `initialize()`: Manually initialize
- `loadKnowledge(source)`: Load knowledge
- `ask(query, options)`: Ask a question
- `clear()`: Clear knowledge base
- `lastAnswer`: Ref<Answer> last generated answer
- `isAsking`: Ref<boolean> processing query
- `isReady`: ComputedRef<boolean> ready to use

### `<DhiyaChat>`

Pre-built chat interface component.

**Props:**
- `config`: Dhiya configuration
- `className`: Custom CSS class
- `placeholder`: Input placeholder text

**Events:**
- `@message`: Emitted with new ChatMessage

### `<DhiyaStatus>`

Status display component.

**Props:**
- `config`: Dhiya configuration
- `className`: Custom CSS class

## License

MIT © Deep Parmar
