import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    let members;

    if (query.trim() === '') {
      // 検索クエリがない場合は全件取得
      members = db.prepare(`
        SELECT id, member_id, name, affiliation, affiliation_detail, email, created_at
        FROM members
        ORDER BY created_at DESC
      `).all();
    } else {
      // 名前、所属、メールアドレス、メンバーIDで部分一致検索
      members = db.prepare(`
        SELECT id, member_id, name, affiliation, affiliation_detail, email, created_at
        FROM members
        WHERE name LIKE ? OR affiliation LIKE ? OR affiliation_detail LIKE ? OR email LIKE ? OR member_id LIKE ?
        ORDER BY created_at DESC
      `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    }

    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error('Search members error:', error);
    return NextResponse.json(
      { success: false, message: '検索エラーが発生しました' },
      { status: 500 }
    );
  }
}
