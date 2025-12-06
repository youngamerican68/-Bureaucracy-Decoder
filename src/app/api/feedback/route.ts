// POST /api/feedback
// Body: { messageId, rating, query, response?, sectionRefs? }
// Response: { success: true }

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messageId, rating, query, response, sectionRefs } = await request.json();

  // Validate required fields
  if (!messageId || !query) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate rating
  if (!['up', 'down'].includes(rating)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }

  const supabase = getServerClient();
  const { error } = await supabase.from('zoning_feedback').insert({
    message_id: messageId,
    user_id: userId,
    rating,
    query,
    response,
    section_refs: sectionRefs ?? []  // Normalize to array
  });

  if (error) {
    console.error('Feedback insert failed:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
