import { NextRequest, NextResponse } from 'next/server';
import { getAllAffiliations } from '@/lib/database';
import { checkAdminAuth } from '@/lib/auth';

// 登録されているすべての所属を取得
export async function GET(request: NextRequest) {
  // 管理者認証チェック
  const unauthorized = await checkAdminAuth();
  if (unauthorized) return unauthorized;

  try {
    const affiliations = getAllAffiliations();
    return NextResponse.json(affiliations);
  } catch (error) {
    console.error('Error fetching affiliations:', error);
    return NextResponse.json({ error: 'Failed to fetch affiliations' }, { status: 500 });
  }
}
