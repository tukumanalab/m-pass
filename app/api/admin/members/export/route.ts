import { NextResponse } from 'next/server';
import db from '@/lib/database';
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
      SELECT email, name, affiliation, affiliation_detail, qr_code, created_at
      FROM members
      ORDER BY created_at DESC
    `).all() as Array<{
      email: string;
      name: string;
      affiliation: string;
      affiliation_detail: string | null;
      qr_code: string;
      created_at: string;
    }>;

    // CSVヘッダー
    let csv = 'email,name,affiliation,affiliation_detail,qr_code,created_at\n';

    // データ行を追加
    for (const member of members) {
      // 日付をYYYY/MM/DD HH:mm:ss形式に変換
      const date = new Date(member.created_at);
      const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

      // 各フィールドをCSV形式に変換（カンマや改行を含む場合はダブルクォートで囲む）
      const fields = [
        member.email,
        member.name,
        member.affiliation,
        member.affiliation_detail || '',
        member.qr_code,
        formattedDate,
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
