'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage as ChatMessageType } from '@/types';
import { ChatMessage } from './ChatMessage';

interface ChatContainerProps {
  messages: ChatMessageType[];
}

export function ChatContainer({ messages }: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Find the user query for each assistant message
  const getUserQueryForMessage = (index: number): string => {
    if (messages[index].role !== 'assistant') return '';
    // Look backwards for the previous user message
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }
    return '';
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">LA</div>
          <h2 className="text-xl font-semibold text-stone-800 mb-2">
            LA Zoning Code Assistant
          </h2>
          <p className="text-stone-600 text-sm">
            Ask questions about Los Angeles zoning regulations. I&apos;ll search across
            Chapter 1 (Zoning), Chapter 1A (Downtown), and Chapter IX (Building Code)
            to find relevant sections and provide citations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-6 max-w-3xl mx-auto">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            userQuery={getUserQueryForMessage(index)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
