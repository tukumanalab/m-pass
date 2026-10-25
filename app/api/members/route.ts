import { NextResponse } from 'next/server';
import { getAllMembers } from '@/lib/database';
import { checkAdminAuth } from '@/lib/auth';

// メンバー一覧を取得
export async function GET() {
  // 管理者認証チェック
  const unauthorized = await checkAdminAuth();
  if (unauthorized) return unauthorized;

  try {
    // パスワードハッシュや確認トークンは返さない
    const members = (getAllMembers() as any[]).map(
      ({ password_hash, verification_token, ...member }) => member
    );
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}
