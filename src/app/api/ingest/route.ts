import { NextRequest, NextResponse } from 'next/server';
import { upsertZoningDoc, ingestZoningCode } from '@/lib/services/ingest';
import { IngestRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: IngestRequest = await request.json();

    if (!body.slug || !body.cityName || !body.codeName || !body.sourceUrl) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: slug, cityName, codeName, sourceUrl',
        },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(body.sourceUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid source URL' },
        { status: 400 }
      );
    }

    // Create or update the document
    const doc = await upsertZoningDoc(
      body.slug,
      body.cityName,
      body.codeName,
      body.sourceUrl,
      {
        region: body.region,
        isFeatured: false, // Custom ingestions are not featured
      }
    );

    // Start ingestion in background (don't await)
    ingestZoningCode(doc.id).catch((error) => {
      console.error(`Background ingestion failed for ${doc.slug}:`, error);
    });

    return NextResponse.json({
      docId: doc.id,
      status: 'ingesting',
      message: `Started ingesting ${body.cityName} - ${body.codeName}. This may take a few minutes.`,
    });
  } catch (error) {
    console.error('Error in /api/ingest:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
