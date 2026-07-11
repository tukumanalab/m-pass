import { NextRequest, NextResponse } from 'next/server';
import { loadSettings, saveSettings } from '@/lib/settings';

// 設定取得
export async function GET() {
  try {
    const settings = loadSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { success: false, message: '設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 設定更新
export async function PUT(request: NextRequest) {
  try {
    const settings = await request.json();

    // バリデーション
    if (!settings.siteName || !settings.pageTitle) {
      return NextResponse.json(
        { success: false, message: 'サイト名とページタイトルは必須です' },
        { status: 400 }
      );
    }

    if (
      settings.checkInIntervalMinutes !== undefined &&
      (typeof settings.checkInIntervalMinutes !== 'number' || settings.checkInIntervalMinutes < 1)
    ) {
      return NextResponse.json(
        { success: false, message: '再チェックイン間隔は1分以上の数値で指定してください' },
        { status: 400 }
      );
    }

    if (
      settings.successDisplaySeconds !== undefined &&
      (typeof settings.successDisplaySeconds !== 'number' || settings.successDisplaySeconds < 1)
    ) {
      return NextResponse.json(
        { success: false, message: 'チェックイン表示時間は1秒以上の数値で指定してください' },
        { status: 400 }
      );
    }

    if (
      settings.checkOutIntervalMinutes !== undefined &&
      (typeof settings.checkOutIntervalMinutes !== 'number' || settings.checkOutIntervalMinutes < 0)
    ) {
      return NextResponse.json(
        { success: false, message: 'チェックアウト延長間隔は0分以上の数値で指定してください' },
        { status: 400 }
      );
    }

    saveSettings(settings);

    return NextResponse.json({ success: true, message: '設定を保存しました' });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { success: false, message: '設定の保存に失敗しました' },
      { status: 500 }
    );
  }
}
