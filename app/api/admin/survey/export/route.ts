import { NextRequest, NextResponse } from 'next/server';
import { getAllSurveyResponses } from '@/lib/database';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const isAuthenticated = await isAdminAuthenticated();
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, message: '認証が必要です' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // 期間フィルタ付きで取得
    const responses = getAllSurveyResponses(startDate, endDate);

    // CSVヘッダー
    let csv = 'member_id,affiliation,how_did_you_know,created_at\n';

    // データ行を追加
    for (const row of responses) {
      const fields = [
        row.member_id,
        row.affiliation,
        row.how_did_you_know || '',
        row.created_at,
      ];

      const csvFields = fields.map(field => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });

      csv += csvFields.join(',') + '\n';
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="survey_${startDate ?? ''}${startDate && endDate ? '_' : ''}${endDate ?? ''}${!startDate && !endDate ? new Date().toISOString().split('T')[0] : ''}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export survey error:', error);
    return NextResponse.json(
      { success: false, message: 'エクスポートエラーが発生しました' },
      { status: 500 }
    );
  }
}
