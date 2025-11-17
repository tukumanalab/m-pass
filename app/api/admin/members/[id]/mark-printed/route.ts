import { NextRequest, NextResponse } from 'next/server';
import { markCardPrinted } from '@/lib/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// メンバーのカード印刷済みフラグを更新
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const memberId = parseInt(id, 10);

    if (isNaN(memberId)) {
      return NextResponse.json(
        { success: false, message: '無効なメンバーIDです' },
        { status: 400 }
      );
    }

    const changes = markCardPrinted(memberId);

    if (changes === 0) {
      return NextResponse.json(
        { success: false, message: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'カード印刷済みフラグを更新しました' 
    });
  } catch (error) {
    console.error('Mark card printed error:', error);
    return NextResponse.json(
      { success: false, message: '更新エラーが発生しました' },
      { status: 500 }
    );
  }
}
