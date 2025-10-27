import { NextResponse } from 'next/server';
import { getCheckInHistory } from '@/lib/database';

// チェックイン履歴をCSV形式でエクスポート
export async function GET() {
  try {
    // 全履歴を取得（limit=999999で実質全件）
    const history = getCheckInHistory(999999, 0) as Array<{
      id: number;
      member_id: number;
      check_in_time: string;
      qr_code: string;
      affiliation: string;
      affiliation_detail: string | null;
    }>;

    // CSVヘッダー
    const headers = ['timestamp', 'qr_code', 'affiliation', 'affiliation_detail'];

    // CSVデータ行を生成
    const rows = history.map(item => {
      // SQLiteのタイムスタンプ（UTC）をJSTに変換
      const date = new Date(item.check_in_time + 'Z');

      // UTCをJSTに変換（+9時間）
      const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

      // YYYY/MM/DD HH:mm:ss形式にフォーマット
      const year = jstDate.getUTCFullYear();
      const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(jstDate.getUTCDate()).padStart(2, '0');
      const hour = String(jstDate.getUTCHours()).padStart(2, '0');
      const minute = String(jstDate.getUTCMinutes()).padStart(2, '0');
      const second = String(jstDate.getUTCSeconds()).padStart(2, '0');
      const formattedDate = `${year}/${month}/${day} ${hour}:${minute}:${second}`;

      return [
        formattedDate,
        item.qr_code || '',
        item.affiliation || '',
        item.affiliation_detail || '',
      ];
    });

    // CSV文字列を生成（RFC 4180準拠、改行は\r\n）
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(field => {
          // フィールドにカンマ、改行、ダブルクォートが含まれる場合はエスケープ
          if (field.includes(',') || field.includes('\n') || field.includes('\r') || field.includes('"')) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        }).join(',')
      ),
    ].join('\r\n');

    // BOM付きUTF-8でレスポンスを返す（Excelで正しく開けるように）
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // ファイル名に日付を含める
    const today = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tokyo',
    }).format(new Date()).replace(/\//g, '-');

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="checkins_${today}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting check-in history:', error);
    return NextResponse.json({ error: 'Failed to export history' }, { status: 500 });
  }
}
