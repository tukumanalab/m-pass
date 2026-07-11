import { NextRequest, NextResponse } from 'next/server';
import db, { getMemberNfcCards } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    let members;

    if (query.trim() === '') {
      // 検索クエリがない場合は全件取得
      members = db.prepare(`
        SELECT id, member_id, name, affiliation, affiliation_detail, email, created_at, mypage_notification_sent_at, card_printed_at
        FROM members
        ORDER BY created_at DESC
      `).all();
    } else {
      // 名前、所属、メールアドレス、メンバーID、NFC IDで部分一致検索
      members = db.prepare(`
        SELECT DISTINCT m.id, m.member_id, m.name, m.affiliation, m.affiliation_detail, m.email, m.created_at, m.mypage_notification_sent_at, m.card_printed_at
        FROM members m
        LEFT JOIN member_nfc_cards c ON m.id = c.member_id
        WHERE m.name LIKE ? OR m.affiliation LIKE ? OR m.affiliation_detail LIKE ? OR m.email LIKE ? OR m.member_id LIKE ? OR c.nfc_id LIKE ?
        ORDER BY m.created_at DESC
      `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    }

    // 各メンバーにNFCカード情報を付与
    const membersWithNfc = (members as any[]).map(m => ({
      ...m,
      nfc_cards: getMemberNfcCards(m.id)
    }));

    return NextResponse.json({ success: true, members: membersWithNfc });
  } catch (error) {
    console.error('Search members error:', error);
    return NextResponse.json(
      { success: false, message: '検索エラーが発生しました' },
      { status: 500 }
    );
  }
}
