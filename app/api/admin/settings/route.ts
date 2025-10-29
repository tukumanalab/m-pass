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
