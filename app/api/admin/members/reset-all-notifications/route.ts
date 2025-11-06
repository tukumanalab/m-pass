import { NextRequest, NextResponse } from 'next/server';
import { resetAllMyPageNotificationFlags } from '@/lib/database';

// 全メンバーのマイページ通知フラグをリセット
export async function POST(request: NextRequest) {
  try {
    const changes = resetAllMyPageNotificationFlags();

    return NextResponse.json({ 
      success: true, 
      message: `${changes}件のメンバーのマイページ通知フラグをリセットしました`,
      count: changes
    });
  } catch (error) {
    console.error('Reset all notification flags error:', error);
    return NextResponse.json(
      { success: false, message: 'リセットエラーが発生しました' },
      { status: 500 }
    );
  }
}
