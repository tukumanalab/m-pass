import { NextResponse } from 'next/server';
import { getTodayCheckIns } from '@/lib/database';

// 本日のチェックイン一覧を取得
export async function GET() {
  try {
    const checkIns = getTodayCheckIns();
    return NextResponse.json(checkIns);
  } catch (error) {
    console.error('Error fetching today check-ins:', error);
    return NextResponse.json({ error: 'Failed to fetch check-ins' }, { status: 500 });
  }
}
