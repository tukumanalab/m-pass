import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

// 環境変数から管理者パスワードを取得（本番環境では必ず設定）
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$eHFkKLHLdUjcLwds5foX..qQ15MU5LY.by7CSpJLIo76BYy4UeK4K'; // デフォルト: "admin123"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { success: false, message: 'パスワードを入力してください' },
        { status: 400 }
      );
    }

    // パスワード検証
    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

    if (isValid) {
      // セッショントークン生成（簡易実装）
      const token = Buffer.from(`admin:${Date.now()}`).toString('base64');

      const response = NextResponse.json({ success: true, message: 'ログイン成功' });

      // HTTPOnlyクッキーにトークンを設定（24時間有効）
      response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24時間
        path: '/',
      });

      return response;
    } else {
      return NextResponse.json(
        { success: false, message: 'パスワードが正しくありません' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    return NextResponse.json(
      { success: false, message: '認証エラーが発生しました' },
      { status: 500 }
    );
  }
}
