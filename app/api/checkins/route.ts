import { NextRequest, NextResponse } from 'next/server';
import { deleteCheckIns, deleteCheckInsByDateRange } from '@/lib/database';

// チェックイン履歴の削除
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, startDate, endDate } = body;

    let deletedCount = 0;

    // 日付範囲指定での削除
    if (startDate && endDate) {
      deletedCount = deleteCheckInsByDateRange(startDate, endDate);
    }
    // ID指定での削除
    else if (ids && Array.isArray(ids) && ids.length > 0) {
      deletedCount = deleteCheckIns(ids);
    }
    else {
      return NextResponse.json({ error: 'IDs or date range are required' }, { status: 400 });
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
