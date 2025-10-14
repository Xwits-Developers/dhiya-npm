<template>
  <div :class="`dhiya-chat ${className}`">
    <div v-if="loading" class="dhiya-loading">
      Loading Dhiya...
    </div>
    <template v-else>
      <div class="dhiya-messages" ref="messagesContainer">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="`dhiya-message dhiya-message-${msg.role}`"
        >
          <div class="dhiya-message-content">{{ msg.content }}</div>
          <div v-if="msg.answer" class="dhiya-message-meta">
            <small>
              {{ (msg.answer.confidence * 100).toFixed(0) }}% confidence
              <template v-if="msg.answer.provider">
                • {{ msg.answer.provider }}
              </template>
              • {{ msg.answer.timing.total }}ms
            </small>
          </div>
        </div>
        <div v-if="isAsking" class="dhiya-message dhiya-message-assistant">
          <div class="dhiya-thinking">💭 Thinking...</div>
        </div>
      </div>
      
      <form class="dhiya-input-form" @submit.prevent="handleSubmit">
        <input
          v-model="input"
          type="text"
          :placeholder="placeholder"
          :disabled="isAsking || !initialized"
          class="dhiya-input"
        />
        <button
          type="submit"
          :disabled="isAsking || !initialized || !input.trim()"
          class="dhiya-button"
        >
          Send
        </button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useRAG, UseRAGOptions } from './useRAG';
import { Answer } from 'dhiya-npm';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  answer?: Answer;
}

interface Props {
  config?: UseRAGOptions;
  className?: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  className: '',
  placeholder: 'Ask me anything...'
});

const emit = defineEmits<{
  (e: 'message', message: ChatMessage): void;
}>();

const { initialized, loading, ask, isAsking } = useRAG(props.config);

const messages = ref<ChatMessage[]>([
  {
    id: '0',
    role: 'assistant',
    content: '👋 Hi! I\'m here to help. What would you like to know?',
    timestamp: Date.now()
  }
]);

const input = ref('');
const messagesContainer = ref<HTMLElement>();

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const handleSubmit = async () => {
  if (!input.value.trim() || isAsking.value || !initialized.value) return;
  
  // Add user message
  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: input.value,
    timestamp: Date.now()
  };
  
  messages.value.push(userMessage);
  input.value = '';
  scrollToBottom();
  
  try {
    // Get answer
    const answer = await ask(input.value);
    
    // Add assistant message
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: answer.text,
      timestamp: Date.now(),
      answer
    };
    
    messages.value.push(assistantMessage);
    emit('message', assistantMessage);
    scrollToBottom();
    
  } catch (error) {
    const errorMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now()
    };
    messages.value.push(errorMessage);
    scrollToBottom();
  }
};
</script>
