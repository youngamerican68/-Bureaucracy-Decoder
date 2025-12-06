'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ChatCitation } from '@/types';

interface CitationCardProps {
  citations: ChatCitation[];
}

export function CitationCard({ citations }: CitationCardProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3">
      <Accordion type="single" collapsible className="w-full">
        {citations.map((citation, index) => (
          <AccordionItem
            key={`${citation.section_ref}-${index}`}
            value={`item-${index}`}
            className="border border-stone-200 rounded-lg mb-2 overflow-hidden"
          >
            <AccordionTrigger className="px-3 py-2 hover:bg-stone-50 text-sm font-medium text-stone-700">
              <div className="flex items-center gap-2">
                <span className="text-amber-600">{citation.section_ref}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 text-sm text-stone-600">
              {citation.content && (
                <p className="mb-2 whitespace-pre-wrap">{citation.content}</p>
              )}
              {citation.source_url && (
                <a
                  href={citation.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-xs"
                >
                  View on AmLegal
                </a>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
