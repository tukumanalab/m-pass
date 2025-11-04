import { NextRequest, NextResponse } from 'next/server';
import { deleteCheckIns, deleteCheckInsByDateRange, deleteAllCheckIns } from '@/lib/database';

// チェックイン履歴の削除
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, startDate, endDate, deleteAll } = body;

    let deletedCount = 0;

    // 全削除
    if (deleteAll === true) {
      deletedCount = deleteAllCheckIns();
    }
    // 日付範囲指定での削除
    else if (startDate && endDate) {
      deletedCount = deleteCheckInsByDateRange(startDate, endDate);
    }
    // ID指定での削除
    else if (ids && Array.isArray(ids) && ids.length > 0) {
      deletedCount = deleteCheckIns(ids);
    }
    else {
      return NextResponse.json({ error: 'IDs, date range, or deleteAll flag are required' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error('Error deleting check-ins:', error);
    return NextResponse.json({ error: 'Failed to delete check-ins' }, { status: 500 });
  }
}
