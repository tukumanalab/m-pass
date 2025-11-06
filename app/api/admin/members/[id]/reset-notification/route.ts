import { NextRequest, NextResponse } from 'next/server';
import { resetMyPageNotificationFlag } from '@/lib/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// メンバーのマイページ通知フラグをリセット
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

    const changes = resetMyPageNotificationFlag(memberId);

    if (changes === 0) {
      return NextResponse.json(
        { success: false, message: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'マイページ通知フラグをリセットしました' 
    });
  } catch (error) {
    console.error('Reset notification flag error:', error);
    return NextResponse.json(
      { success: false, message: 'リセットエラーが発生しました' },
      { status: 500 }
    );
  }
}
