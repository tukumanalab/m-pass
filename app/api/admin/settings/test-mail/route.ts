import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { sendTestEmail } from '@/lib/mailer';

// テストメール送信（管理者のみ）
export async function POST(request: NextRequest) {
  const unauthorized = await checkAdminAuth();
  if (unauthorized) return unauthorized;

  try {
    const { to } = await request.json();

    if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { success: false, message: '有効なメールアドレスを入力してください' },
        { status: 400 }
      );
    }

    await sendTestEmail(to);
    return NextResponse.json({ success: true, message: `${to} にテストメールを送信しました` });
  } catch (error) {
    console.error('Test email error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: `テストメールの送信に失敗しました: ${detail}` },
      { status: 500 }
    );
  }
}
