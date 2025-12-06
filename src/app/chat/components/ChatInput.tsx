'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const EXAMPLE_QUERIES = [
  'parking restaurant C2',
  'height limit R3 zone',
  'setback requirements hillside',
  'ADU requirements R1',
  'density bonus affordable housing',
];

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  showExamples?: boolean;
}

export function ChatInput({ onSend, disabled, showExamples }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setMessage('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleClick = (query: string) => {
    // Send the example query directly
    if (!disabled) {
      onSend(query);
    }
  };

  return (
    <div className="border-t border-stone-200 bg-white p-4">
      {/* Example queries - shown for first-time users */}
      {showExamples && (
        <div className="mb-3">
          <p className="text-xs text-stone-500 mb-2">Try asking about:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((query) => (
              <button
                key={query}
                onClick={() => handleExampleClick(query)}
                className="px-3 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full transition-colors"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about LA zoning code..."
          disabled={disabled}
          className="min-h-[44px] max-h-32 resize-none text-stone-900 bg-white border-stone-300"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="h-11 w-11 p-0 bg-amber-500 hover:bg-amber-600"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      <p className="text-xs text-stone-400 mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
