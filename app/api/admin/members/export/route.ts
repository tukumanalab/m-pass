import { NextResponse } from 'next/server';
import db, { getMemberNfcCards } from '@/lib/database';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    // 認証チェック
    const isAuthenticated = await isAdminAuthenticated();
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, message: '認証が必要です' },
        { status: 401 }
      );
    }

    // 全メンバーデータを取得
    const members = db.prepare(`
      SELECT id, email, name, affiliation, affiliation_detail, organization_member_id, member_id, created_at, mypage_notification_sent_at
      FROM members
      ORDER BY created_at DESC
    `).all() as Array<{
      id: number;
      email: string;
      name: string;
      affiliation: string;
      affiliation_detail: string | null;
      organization_member_id: string | null;
      member_id: string;
      created_at: string;
      mypage_notification_sent_at: string | null;
    }>;

    // CSVヘッダー
    let csv = 'email,name,affiliation,affiliation_detail,organization_member_id,member_id,created_at,mypage_notification_sent_at,nfc_id\n';

    // データ行を追加
    for (const member of members) {
      // created_at は既にISO形式なのでそのまま使用
      const createdAt = member.created_at;

      // mypage_notification_sent_at も同じくISO形式
      const notificationSentAt = member.mypage_notification_sent_at || '';

      // NFC IDを取得 (セミコロン区切り)
      const nfcCards = getMemberNfcCards(member.id);
      const nfcIds = nfcCards.map(c => c.nfc_id).join(';');

      // 各フィールドをCSV形式に変換（カンマや改行を含む場合はダブルクォートで囲む）
      const fields = [
        member.email,
        member.name,
        member.affiliation,
        member.affiliation_detail || '',
        member.organization_member_id || '',
        member.member_id,
        createdAt,
        notificationSentAt,
        nfcIds,
      ];

      const csvFields = fields.map(field => {
        // フィールドにカンマ、ダブルクォート、改行が含まれる場合
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          // ダブルクォートをエスケープして、フィールド全体をダブルクォートで囲む
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });

      csv += csvFields.join(',') + '\n';
    }

    // CSVファイルとしてレスポンスを返す
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="members_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export members error:', error);
    return NextResponse.json(
      { success: false, message: 'エクスポートエラーが発生しました' },
      { status: 500 }
    );
  }
}
