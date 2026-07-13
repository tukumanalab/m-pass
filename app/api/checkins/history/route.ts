import { NextRequest, NextResponse } from 'next/server';
import { getCheckInHistory } from '@/lib/database';

// チェックイン履歴を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const affiliation = searchParams.get('affiliation') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const history = getCheckInHistory(limit, offset, affiliation, startDate, endDate);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching check-in history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
