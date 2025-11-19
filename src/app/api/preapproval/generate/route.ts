import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { generatePreapprovalPacket } from '@/lib/services/packet';
import { GeneratePacketRequest } from '@/types';
import { Json } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body: GeneratePacketRequest = await request.json();

    if (!body.docId || !body.userInput) {
      return NextResponse.json(
        { error: 'Missing required fields: docId and userInput' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Get document info for city name
    const { data: doc, error: docError } = await supabase
      .from('zoning_docs')
      .select('city_name')
      .eq('id', body.docId)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Generate the packet
    const packet = await generatePreapprovalPacket(body.docId, body.userInput);

    // Create a request record
    const requestId = uuidv4();
    const { error: insertError } = await supabase
      .from('preapproval_requests')
      .insert({
        id: requestId,
        doc_id: body.docId,
        city_name: doc.city_name,
        user_input: body.userInput as unknown as Json,
        site_plan_metadata: (body.sitePlanMetadata || null) as unknown as Json,
        packet_summary: packet.summary,
        packet_full: packet as unknown as Json,
        overall_risk: packet.overall_risk,
        status: 'completed',
      });

    if (insertError) {
      console.error('Failed to save request:', insertError);
      // Still return the packet even if save fails
    }

    return NextResponse.json({
      requestId,
      packet,
    });
  } catch (error) {
    console.error('Error in /api/preapproval/generate:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
