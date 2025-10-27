import { NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings';

// クライアント向け設定取得API（認証不要）
export async function GET() {
  try {
    const settings = loadSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: '設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}
