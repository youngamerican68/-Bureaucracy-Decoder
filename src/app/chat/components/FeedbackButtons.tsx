'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeedbackButtonsProps {
  messageId: string;
  query: string;
  response: string;
  sectionRefs: string[];
}

export function FeedbackButtons({ messageId, query, response, sectionRefs }: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<'up' | 'down' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFeedback = async (rating: 'up' | 'down') => {
    if (submitted || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          rating,
          query,
          response,
          sectionRefs,
        }),
      });

      if (res.ok) {
        setSubmitted(rating);
      }
    } catch (error) {
      console.error('Feedback submission failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1 text-xs text-stone-500">
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleFeedback('up')}
        disabled={loading}
        className="h-7 w-7 p-0 text-stone-400 hover:text-green-600 hover:bg-green-50"
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleFeedback('down')}
        disabled={loading}
        className="h-7 w-7 p-0 text-stone-400 hover:text-red-600 hover:bg-red-50"
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
