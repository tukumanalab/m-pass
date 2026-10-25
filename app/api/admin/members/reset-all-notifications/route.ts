import { NextRequest, NextResponse } from 'next/server';
import { resetAllMyPageNotificationFlags } from '@/lib/database';
import { checkAdminAuth } from '@/lib/auth';

// 全メンバーのマイページ通知フラグをリセット
export async function POST(request: NextRequest) {
  // 管理者認証チェック
  const unauthorized = await checkAdminAuth();
  if (unauthorized) return unauthorized;

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
