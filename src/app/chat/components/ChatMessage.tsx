'use client';

import { ChatMessage as ChatMessageType } from '@/types';
import { CitationCard } from './CitationCard';
import { FeedbackButtons } from './FeedbackButtons';
import { Disclaimer } from './Disclaimer';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  userQuery?: string; // The original user query for this assistant message
}

export function ChatMessage({ message, userQuery }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600' : 'bg-amber-100'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-amber-700" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-stone-100 text-stone-800 rounded-tl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>

        {/* Assistant-only elements */}
        {!isUser && (
          <div className="mt-2">
            {/* Confidence badge */}
            {message.confidence && (
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full mb-2 ${
                  message.confidence === 'high'
                    ? 'bg-green-100 text-green-700'
                    : message.confidence === 'medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {message.confidence} confidence
              </span>
            )}

            {/* Citations */}
            {message.citations && message.citations.length > 0 && (
              <CitationCard citations={message.citations} />
            )}

            {/* Feedback buttons */}
            <div className="mt-2 flex items-center gap-2">
              <FeedbackButtons
                messageId={message.id}
                query={userQuery || ''}
                response={message.content}
                sectionRefs={message.citations?.map((c) => c.section_ref) || []}
              />
            </div>

            {/* Disclaimer - only under assistant messages */}
            <Disclaimer />
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-stone-400 mt-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
