// POST /api/chat
// Request:  { message: string }
// Response: { response: string, citations: ChatCitation[], messageId: string, confidence: string }

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getServerClient } from '@/lib/supabase';
import { askZoningQuestion } from '@/lib/services/packet';

const DAILY_LIMIT = 50;

export async function POST(request: NextRequest) {
  // 1. Auth check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate limit check (with error handling)
  const supabase = getServerClient();
  const { data: currentCount, error: rpcError } = await supabase.rpc('increment_usage', {
    p_user_id: userId
  });

  // Handle RPC failure gracefully
  if (rpcError || currentCount === null) {
    console.error('Rate limit RPC failed:', rpcError);
    return NextResponse.json({ error: 'Rate limit check failed' }, { status: 500 });
  }

  // Note: increment_usage() returns the *new* count after increment.
  // With DAILY_LIMIT = 50, requests 1–50 are allowed.
  // The 51st request (count = 51) is the first to be blocked.
  if (currentCount > DAILY_LIMIT) {
    return NextResponse.json({
      error: 'Rate limit exceeded (50 queries/day)',
      upgradeUrl: '/pricing'
    }, { status: 429 });
  }

  // 3. Get message (simple string, not history array)
  const { message } = await request.json();

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // 4. Use existing askZoningQuestion
  // Note: The docId param is ignored - getRelevantZoningSections() in rag.ts
  // automatically searches ALL 3 LA chapters (1, 1A, IX) with intent routing
  const result = await askZoningQuestion('los-angeles-chapter1', message);

  // 5. Safety check - ensure we got a valid response
  if (!result || !result.answer) {
    return NextResponse.json(
      { error: 'Failed to generate answer' },
      { status: 500 }
    );
  }

  // 6. Return response
  return NextResponse.json({
    response: result.answer,
    citations: result.citations.map(c => ({
      section_ref: c.section_ref,
      content: c.snippet,
      source_url: 'https://codelibrary.amlegal.com/codes/los_angeles'
    })),
    confidence: result.confidence,
    messageId: uuidv4()
  });
}
