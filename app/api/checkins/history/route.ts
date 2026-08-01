import { NextRequest, NextResponse } from 'next/server';
import { getCheckInHistory, getCheckInHistoryCount } from '@/lib/database';

// チェックイン履歴を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50'));
    const pageParam = searchParams.get('page');
    let page = pageParam ? parseInt(pageParam) : 1;
    if (isNaN(page) || page < 1) page = 1;

    const offsetParam = searchParams.get('offset');
    const offset = offsetParam !== null ? parseInt(offsetParam) : (page - 1) * limit;

    const affiliation = searchParams.get('affiliation') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const total = getCheckInHistoryCount(affiliation, startDate, endDate);
    const history = getCheckInHistory(limit, offset, affiliation, startDate, endDate);
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      items: history,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching check-in history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

