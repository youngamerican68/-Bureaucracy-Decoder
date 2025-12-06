'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatState, ChatCitation } from '@/types';
import { ChatContainer } from './components/ChatContainer';
import { ChatInput } from './components/ChatInput';
import { Loader2 } from 'lucide-react';

const STORAGE_KEY = 'la-zoning-chat-history-v1';
const MAX_MESSAGES = 50;

interface ApiResponse {
  response: string;
  citations: ChatCitation[];
  confidence: string;
  messageId: string;
  error?: string;
  upgradeUrl?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: ChatState = JSON.parse(stored);
        setMessages(state.messages || []);
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  }, []);

  // Save messages to localStorage whenever they change
  const saveMessages = useCallback((msgs: ChatMessage[]) => {
    try {
      // Keep only the last MAX_MESSAGES (FIFO cleanup)
      const trimmed = msgs.slice(-MAX_MESSAGES);
      const state: ChatState = {
        messages: trimmed,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }, []);

  const handleSend = async (content: string) => {
    setError(null);

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveMessages(updatedMessages);

    // Call API
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error || 'Rate limit exceeded. Try again tomorrow.');
        } else if (res.status === 401) {
          setError('Please sign in to continue.');
        } else {
          setError(data.error || 'Something went wrong. Please try again.');
        }
        return;
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: data.messageId,
        role: 'assistant',
        content: data.response,
        createdAt: new Date().toISOString(),
        citations: data.citations,
        confidence: data.confidence,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveMessages(finalMessages);
    } catch (e) {
      console.error('Chat API error:', e);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages area */}
      <ChatContainer messages={messages} />

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Searching zoning code...</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        disabled={loading}
        showExamples={messages.length === 0}
      />

      {/* Clear history button - shown when there are messages */}
      {messages.length > 0 && (
        <div className="text-center pb-2">
          <button
            onClick={clearHistory}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Clear chat history
          </button>
        </div>
      )}
    </div>
  );
}
