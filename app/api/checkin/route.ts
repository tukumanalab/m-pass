import { NextRequest, NextResponse } from 'next/server';
import { findMemberByQRCode, createCheckIn, getLatestCheckIn } from '@/lib/database';

// QRコードでチェックイン
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrCode } = body;

    if (!qrCode) {
      return NextResponse.json({ error: 'QRコードが読み取れませんでした' }, { status: 400 });
    }

    // QRコードからメンバーを検索
    const member = findMemberByQRCode(qrCode) as any;

    if (!member) {
      return NextResponse.json({ error: '登録されていないQRコードです' }, { status: 404 });
    }

    // 最新のチェックイン時刻を確認
    const latestCheckIn = getLatestCheckIn(member.id);

    if (latestCheckIn) {
      // SQLiteのタイムスタンプ（UTC）をJavaScriptのDateオブジェクトに変換
      // CURRENT_TIMESTAMPで保存されているため、UTCとして解釈
      const lastCheckInTime = new Date(latestCheckIn.check_in_time + 'Z').getTime();
      const currentTime = Date.now();
      const oneHourInMs = 60 * 60 * 1000; // 1時間 = 60分 × 60秒 × 1000ミリ秒
      const timeDiff = currentTime - lastCheckInTime;

      // 1時間以内に既にチェックインしている場合はエラー
      if (timeDiff < oneHourInMs) {
        return NextResponse.json(
          { error: 'このメンバーは既にチェックイン済みです。' },
          { status: 429 }
        );
      }
    }

    // チェックインを記録
    const checkInId = createCheckIn(member.id);

    return NextResponse.json({
      success: true,
      checkIn: {
        id: checkInId,
        memberId: member.id,
        memberName: member.name,
        affiliation: member.affiliation,
        email: member.email,
      },
    });
  } catch (error) {
    console.error('Error during check-in:', error);
    return NextResponse.json({ error: 'チェックイン処理中にエラーが発生しました' }, { status: 500 });
  }
}
