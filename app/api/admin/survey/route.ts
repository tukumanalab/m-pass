import { NextRequest, NextResponse } from 'next/server';
import { getAllSurveyResponses } from '@/lib/database';
import { isAdminAuthenticated } from '@/lib/auth';
import { SURVEY_OPTIONS, SURVEY_OTHER_OPTION } from '@/lib/survey-config';

export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = await isAdminAuthenticated();
    if (!isAuthenticated) {
      return NextResponse.json({ success: false, message: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const responses = getAllSurveyResponses(startDate, endDate);

    // 選択肢ごとの集計（設定ファイルの順序を維持）
    const optionLabels = SURVEY_OPTIONS.map((o) => o.label);
    const countMap: Record<string, number> = {};
    for (const label of optionLabels) {
      countMap[label] = 0;
    }
    let noAnswerCount = 0;
    const otherTexts: string[] = [];

    for (const row of responses) {
      if (!row.how_did_you_know) {
        noAnswerCount++;
        continue;
      }
      // "その他: ..." のように保存されているものも "その他" にまとめる
      const matchedLabel = optionLabels.find(
        (label) => row.how_did_you_know === label || row.how_did_you_know!.startsWith(label + ': ')
      );
      if (matchedLabel) {
        countMap[matchedLabel]++;
        // 「その他」の自由記述テキストを収集
        if (matchedLabel === SURVEY_OTHER_OPTION && row.how_did_you_know!.startsWith(SURVEY_OTHER_OPTION + ': ')) {
          otherTexts.push(row.how_did_you_know!.slice(SURVEY_OTHER_OPTION.length + 2));
        }
      }
    }

    const chartData = optionLabels.map((label) => ({
      label,
      count: countMap[label],
    }));

    return NextResponse.json({
      success: true,
      total: responses.length,
      noAnswerCount,
      chartData,
      otherTexts,
    });
  } catch (error) {
    console.error('Survey stats error:', error);
    return NextResponse.json({ success: false, message: 'エラーが発生しました' }, { status: 500 });
  }
}
