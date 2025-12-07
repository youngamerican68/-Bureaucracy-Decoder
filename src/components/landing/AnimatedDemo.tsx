'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, ExternalLink } from 'lucide-react';

// Demo scenarios to cycle through - exact Q&A from the real system
// Using shorter answers for snappier demo experience
const DEMO_SCENARIOS = [
  {
    query: "What is the minimum lot size in R1?",
    thinking: "Searching R1 zone requirements...",
    answer: "The minimum lot size in R1 zones is generally **5,000 square feet**, with a minimum width of **50 feet**.\n\n**Confirmed by excerpts:** [See §12.09.C.4, which references R1 standards]\n\n**Caveats and Exceptions:**\n* **Substandard Lots:** If a lot was held under separate ownership or was of record when the zoning regulations became effective and is less than 5,000 square feet, it may still be permitted for certain uses.\n* **Small Lot Subdivisions:** Small lot subdivisions can have different minimum lot sizes and widths, as specified in §12.22.C.27.\n\nPlease verify this interpretation with the full code section and consult a licensed professional for official guidance.",
    citation: {
      section: "§12.09.C.4",
      text: "Every lot in an R1 Zone shall have a minimum area of 5,000 square feet and a minimum width of 50 feet.",
      label: "R1 Zone Requirements"
    },
    confidence: "medium"
  },
  {
    query: "What is the maximum FAR in C2 with Height District 1?",
    thinking: "Searching height district regulations...",
    answer: "The maximum Floor Area Ratio (FAR) in a C2 zone with Height District 1 is **1.5:1** for commercial uses.\n\n**Confirmed by excerpts:** [12.21.1.A.1]\n> The total Floor Area contained in all the main Buildings on a Lot in a commercial or industrial zone in Height District No. 1 shall not exceed one-and-one-half times the Buildable Area of the Lot.\n\n**Caveats:**\n* Residential uses may have different FAR calculations.\n* Density Bonus programs may allow increases for affordable housing.\n* Specific Plans or overlay districts may have different regulations.\n\nPlease verify this interpretation with the full code section and consult a licensed professional for official guidance.",
    citation: {
      section: "§12.21.1.A.1",
      text: "The total Floor Area in Height District No. 1 shall not exceed one-and-one-half times the Buildable Area of the Lot.",
      label: "Height Districts"
    },
    confidence: "medium"
  },
  {
    query: "Can I build an ADU on my R1 property?",
    thinking: "Searching ADU regulations...",
    answer: "**Yes**, you can likely build an ADU on your R1 property. ADUs are generally permitted where residential uses are allowed.\n\n**Confirmed by excerpts:** [§12.22.D.33(c)(3)]\n> Except where otherwise prohibited by this subdivision, an ADU is permitted in all zones where residential uses are permitted by right.\n\n**Caveats:**\n* ADUs are prohibited in Very High Fire Hazard Severity Zones within Hillside Areas unless exceptions are met.\n* Specific development standards in §12.22.D.33 apply.\n\nPlease verify with the full code section and consult a licensed professional.",
    citation: {
      section: "§12.22.D.33",
      text: "An ADU is permitted in all zones where residential uses are permitted by right.",
      label: "ADU Regulations"
    },
    confidence: "medium"
  }
];

// Typewriter effect hook
function useTypewriter(text: string, speed: number = 30, startDelay: number = 0) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayText('');
    setIsComplete(false);

    const startTimeout = setTimeout(() => {
      let i = 0;
      const timer = setInterval(() => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1));
          i++;
        } else {
          setIsComplete(true);
          clearInterval(timer);
        }
      }, speed);

      return () => clearInterval(timer);
    }, startDelay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, startDelay]);

  return { displayText, isComplete };
}

// Format markdown-like text (bold and section references)
function formatText(text: string) {
  // Split on bold markers, bracketed refs [12.21.A.4], and § refs like §12.22.D.33(c)(3)
  const parts = text.split(/(\*\*[^*]+\*\*|\[[0-9]+\.[0-9A-Za-z.(),]+\]|§[0-9]+\.[0-9A-Za-z.()]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-stone-900 font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Bracketed section refs like [12.21.A.4]
    if (part.startsWith('[') && part.endsWith(']') && /^\[\d/.test(part)) {
      return <span key={i} className="text-amber-600 font-medium">{part}</span>;
    }
    // Section symbol refs like §12.22.D.33
    if (part.startsWith('§')) {
      return <span key={i} className="text-amber-600 font-medium">{part}</span>;
    }
    return part;
  });
}

export const AnimatedDemo: React.FC = () => {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'thinking' | 'answering' | 'complete'>('typing');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerComplete, setAnswerComplete] = useState(false);

  const scenario = DEMO_SCENARIOS[scenarioIndex];

  // Typewriter for query
  const { displayText: queryText, isComplete: queryComplete } = useTypewriter(
    scenario.query,
    40,
    500
  );

  // Handle phase transitions
  useEffect(() => {
    if (queryComplete && phase === 'typing') {
      // Small pause after typing, then "send"
      const timer = setTimeout(() => setPhase('thinking'), 800);
      return () => clearTimeout(timer);
    }
  }, [queryComplete, phase]);

  useEffect(() => {
    if (phase === 'thinking') {
      // Simulate API call
      const timer = setTimeout(() => setPhase('answering'), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Answer typewriter effect
  useEffect(() => {
    if (phase === 'answering') {
      setAnswerText('');
      setAnswerComplete(false);

      let i = 0;
      const text = scenario.answer;
      const speed = 15; // Typing speed (15ms per character)

      const timer = setInterval(() => {
        if (i < text.length) {
          setAnswerText(text.slice(0, i + 1));
          i++;
        } else {
          setAnswerComplete(true);
          clearInterval(timer);
        }
      }, speed);

      return () => clearInterval(timer);
    }
  }, [phase, scenario.answer]);

  // Transition to complete when answer typing finishes
  useEffect(() => {
    if (answerComplete && phase === 'answering') {
      const timer = setTimeout(() => setPhase('complete'), 500);
      return () => clearTimeout(timer);
    }
  }, [answerComplete, phase]);

  // Auto-scroll during typing to keep content visible
  useEffect(() => {
    if (phase === 'answering' && scrollRef.current) {
      // Smooth scroll to bottom as text types
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [answerText, phase]);

  // Scroll to show citation when it appears
  useEffect(() => {
    if (answerComplete && scrollRef.current) {
      // Wait for citation to render, then smooth scroll
      const scrollDelay = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 500);
      return () => clearTimeout(scrollDelay);
    }
  }, [answerComplete]);

  useEffect(() => {
    if (phase === 'complete') {
      // Wait then cycle to next scenario
      const timer = setTimeout(() => {
        setScenarioIndex((prev) => (prev + 1) % DEMO_SCENARIOS.length);
        setPhase('typing');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Reset when scenario changes
  useEffect(() => {
    setPhase('typing');
    setAnswerText('');
    setAnswerComplete(false);
  }, [scenarioIndex]);

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      {/* App Interface */}
      <div className="bg-white border border-stone-300/80 rounded-lg overflow-hidden shadow-xl">
        {/* Header */}
        <div className="h-14 border-b border-stone-200 bg-white flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-stone-800">Compliance Compass</span>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">LA</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-stone-200" />
        </div>

        {/* Chat Area */}
        <div className="h-[620px] flex flex-col">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {/* User Message */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`user-${scenarioIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-end"
              >
                <div className="max-w-[80%] bg-amber-500 text-white rounded-2xl rounded-br-md px-4 py-2 shadow-sm">
                  <p className="text-sm">{phase === 'typing' ? queryText : scenario.query}</p>
                  {phase === 'typing' && !queryComplete && (
                    <span className="inline-block w-0.5 h-4 bg-white/70 animate-pulse ml-0.5" />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Assistant Message */}
            <AnimatePresence>
              {phase !== 'typing' && (
                <motion.div
                  key={`assistant-${scenarioIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="max-w-[85%] space-y-3">
                    {/* Main response */}
                    <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                      {phase === 'thinking' ? (
                        <div className="flex items-center gap-2 text-stone-500 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                          <span>{scenario.thinking}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-stone-700 space-y-2">
                          {answerText.split('\n\n').map((para, i) => (
                            <div key={i}>
                              {para.split('\n').map((line, j) => {
                                // Blockquote styling
                                if (line.startsWith('>')) {
                                  return (
                                    <p key={j} className="ml-3 pl-2 border-l-2 border-amber-300 italic text-stone-600 text-xs">
                                      {formatText(line.slice(1).trim())}
                                    </p>
                                  );
                                }
                                // Bullet point styling (* followed by space, or •)
                                if (line.startsWith('* ') || line.startsWith('•')) {
                                  const bulletText = line.startsWith('* ') ? '•' + line.slice(1) : line;
                                  return <p key={j} className="ml-2">{formatText(bulletText)}</p>;
                                }
                                // Regular line
                                return <p key={j}>{formatText(line)}</p>;
                              })}
                            </div>
                          ))}
                          {phase === 'answering' && !answerComplete && (
                            <span className="inline-block w-1.5 h-4 bg-amber-500 animate-pulse" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Citation Card and Confidence - show together after answer finishes */}
                    {(answerComplete || phase === 'complete') && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                        className="space-y-3"
                      >
                        {/* Citation Card */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                  {scenario.citation.section}
                                </span>
                                <span className="text-xs text-stone-500">{scenario.citation.label}</span>
                              </div>
                              <p className="text-xs text-stone-600 italic leading-relaxed">
                                &quot;{scenario.citation.text}&quot;
                              </p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-amber-600 shrink-0 mt-1" />
                          </div>
                        </div>

                        {/* Confidence badge */}
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            scenario.confidence === 'high'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {scenario.confidence} confidence
                          </span>
                          <span className="text-xs text-stone-400">
                            Always verify with official sources
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          <div className="border-t border-stone-200 bg-white p-3">
            <div className="flex gap-2">
              <div className="flex-1 bg-stone-100 rounded-lg px-4 py-2 text-sm text-stone-400">
                Ask about LA zoning code...
              </div>
              <button className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario indicator dots */}
      <div className="flex justify-center gap-2 mt-4">
        {DEMO_SCENARIOS.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setScenarioIndex(i);
              setPhase('typing');
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === scenarioIndex ? 'bg-amber-500 w-4' : 'bg-stone-300 hover:bg-stone-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default AnimatedDemo;
