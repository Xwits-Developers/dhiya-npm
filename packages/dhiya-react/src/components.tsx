/**
 * React components for Dhiya
 */

import React, { useState, useEffect, FormEvent } from 'react';
import { useRAG, UseRAGOptions } from './useRAG';
import { Answer } from 'dhiya-npm';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  answer?: Answer;
}

export interface DhiyaChatProps {
  config?: UseRAGOptions;
  onMessage?: (message: ChatMessage) => void;
  className?: string;
  placeholder?: string;
}

export function DhiyaChat({
  config,
  onMessage,
  className = '',
  placeholder = 'Ask me anything...'
}: DhiyaChatProps) {
  const { initialized, loading, ask, isAsking } = useRAG(config);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: '👋 Hi! I\'m here to help. What would you like to know?',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAsking || !initialized) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    try {
      // Get answer
      const answer = await ask(input);
      
      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer.text,
        timestamp: Date.now(),
        answer
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      onMessage?.(assistantMessage);
      
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };
  
  if (loading) {
    return (
      <div className={`dhiya-chat ${className}`}>
        <div className="dhiya-loading">Loading Dhiya...</div>
      </div>
    );
  }
  
  return (
    <div className={`dhiya-chat ${className}`}>
      <div className="dhiya-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`dhiya-message dhiya-message-${msg.role}`}>
            <div className="dhiya-message-content">{msg.content}</div>
            {msg.answer && (
              <div className="dhiya-message-meta">
                <small>
                  {(msg.answer.confidence * 100).toFixed(0)}% confidence
                  {msg.answer.provider && ` • ${msg.answer.provider}`}
                  {` • ${msg.answer.timing.total}ms`}
                </small>
              </div>
            )}
          </div>
        ))}
        {isAsking && (
          <div className="dhiya-message dhiya-message-assistant">
            <div className="dhiya-thinking">💭 Thinking...</div>
          </div>
        )}
      </div>
      
      <form className="dhiya-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isAsking || !initialized}
          className="dhiya-input"
        />
        <button
          type="submit"
          disabled={isAsking || !initialized || !input.trim()}
          className="dhiya-button"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export interface DhiyaStatusProps {
  config?: UseRAGOptions;
  className?: string;
}

export function DhiyaStatus({ config, className = '' }: DhiyaStatusProps) {
  const { status, initialized, loading } = useRAG(config);
  
  if (loading) {
    return <div className={`dhiya-status ${className}`}>Loading...</div>;
  }
  
  if (!initialized || !status) {
    return <div className={`dhiya-status ${className}`}>Not initialized</div>;
  }
  
  return (
    <div className={`dhiya-status ${className}`}>
      <div className="dhiya-status-item">
        <span>Embeddings:</span>
        <span className={status.embedding.ready ? 'status-ready' : 'status-loading'}>
          {status.embedding.ready ? '✅ Ready' : '⏳ Loading'}
        </span>
      </div>
      <div className="dhiya-status-item">
        <span>LLM:</span>
        <span className={status.llm.available ? 'status-ready' : 'status-unavailable'}>
          {status.llm.available ? `✅ ${status.llm.provider}` : '❌ Unavailable'}
        </span>
      </div>
      <div className="dhiya-status-item">
        <span>Knowledge Base:</span>
        <span>{status.knowledgeBase.chunkCount} chunks</span>
      </div>
    </div>
  );
}
