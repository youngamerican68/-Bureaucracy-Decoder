import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerClient();
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get('featured');

    let query = supabase
      .from('zoning_docs')
      .select('id, slug, city_name, code_name, region, status, is_featured, chunk_count, last_crawled_at')
      .order('city_name');

    if (featured === 'true') {
      query = query.eq('is_featured', true);
    } else if (featured === 'false') {
      query = query.eq('is_featured', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ docs: data });
  } catch (error) {
    console.error('Error in /api/zoning/docs:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
