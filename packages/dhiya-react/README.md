# @dhiya/react

React bindings for [Dhiya](https://github.com/Xwits-Developers/dhiya-npm) - Client-side RAG framework.

## Installation

```bash
npm install @dhiya/react dhiya-npm
```

## Quick Start

### Using the Hook

```tsx
import { useRAG } from '@dhiya/react';

function App() {
  const { initialized, loading, ask, loadKnowledge } = useRAG({
    debug: true,
    enableLLM: true
  });
  
  useEffect(() => {
    if (initialized) {
      loadKnowledge({
        type: 'json',
        data: [{ title: 'Hello', content: 'World' }]
      });
    }
  }, [initialized]);
  
  const handleAsk = async () => {
    const answer = await ask('What is this about?');
    console.log(answer.text);
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <button onClick={handleAsk}>Ask Question</button>
  );
}
```

### Using Components

```tsx
import { DhiyaChat, DhiyaStatus } from '@dhiya/react';

function App() {
  return (
    <div>
      <DhiyaStatus />
      <DhiyaChat
        config={{ debug: true, enableLLM: true }}
        onMessage={(msg) => console.log(msg)}
        placeholder="Ask anything..."
      />
    </div>
  );
}
```

## API

### `useRAG(options)`

Hook that manages Dhiya client lifecycle.

**Returns:**
- `client`: DhiyaClient instance
- `status`: Current system status
- `initialized`: Whether client is ready
- `loading`: Whether an operation is in progress
- `error`: Last error if any
- `progress`: Current operation progress
- `initialize()`: Manually initialize
- `loadKnowledge(source)`: Load knowledge
- `ask(query, options)`: Ask a question
- `clear()`: Clear knowledge base
- `lastAnswer`: Last generated answer
- `isAsking`: Whether currently processing a query

### `<DhiyaChat>`

Pre-built chat interface component.

**Props:**
- `config`: Dhiya configuration
- `onMessage`: Callback for new messages
- `className`: Custom CSS class
- `placeholder`: Input placeholder text

### `<DhiyaStatus>`

Status display component.

**Props:**
- `config`: Dhiya configuration
- `className`: Custom CSS class

## License

MIT © Deep Parmar
