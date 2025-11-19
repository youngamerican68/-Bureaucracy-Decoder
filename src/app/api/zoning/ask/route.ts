import { NextRequest, NextResponse } from 'next/server';
import { askZoningQuestion } from '@/lib/services/packet';
import { AskZoningRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: AskZoningRequest = await request.json();

    if (!body.docId || !body.question) {
      return NextResponse.json(
        { error: 'Missing required fields: docId and question' },
        { status: 400 }
      );
    }

    const response = await askZoningQuestion(body.docId, body.question);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/zoning/ask:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
