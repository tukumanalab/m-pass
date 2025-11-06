import { NextRequest, NextResponse } from 'next/server';
import { findMemberByMemberId, getMemberById, createCheckIn, getLatestCheckIn, markMyPageNotificationSent } from '@/lib/database';
import { sendMyPageAnnouncementEmail } from '@/lib/mailer';

// 2025年11月6日 23:59:59 (JST) のUTC時刻
const MYPAGE_ANNOUNCEMENT_CUTOFF_DATE = new Date('2025-11-06T23:59:59+09:00');

// member_idまたはデータベースIDでチェックイン
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrCode, memberId } = body;

    let member: any = null;

    // memberIdが指定されている場合は、データベースIDから検索
    if (memberId) {
      member = getMemberById(memberId);
    }
    // qrCodeが指定されている場合は、member_idから検索
    else if (qrCode) {
      member = findMemberByMemberId(qrCode) as any;
    }
    // どちらも指定されていない場合はエラー
    else {
      return NextResponse.json({ error: 'メンバーIDが読み取れませんでした' }, { status: 400 });
    }

    if (!member) {
      return NextResponse.json({ error: '登録されていないメンバーIDです' }, { status: 404 });
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

    // マイページ案内メールの送信判定
    // 条件: 2025年11月6日以前に登録 & まだ通知を送信していない & メールアドレスがある
    const memberCreatedAt = new Date(member.created_at);
    const shouldSendAnnouncement = 
      memberCreatedAt <= MYPAGE_ANNOUNCEMENT_CUTOFF_DATE && 
      !member.mypage_notification_sent_at &&
      member.email;

    if (shouldSendAnnouncement) {
      console.log(`[MyPage Announcement] Member ${member.member_id} is eligible for announcement email`);
      try {
        // マイページ案内メールを非同期で送信（エラーが発生してもチェックインは成功とする）
        await sendMyPageAnnouncementEmail(
          member.email,
          member.name,
          member.member_id
        );
        // 送信済みフラグを更新
        markMyPageNotificationSent(member.id);
        console.log(`[MyPage Announcement] Email successfully sent to member ${member.member_id} (${member.email})`);
      } catch (error) {
        console.error(`[MyPage Announcement] Failed to send email to member ${member.member_id}:`, error);
        // メール送信エラーはログに記録するのみで、チェックインは成功とする
        // 送信済みフラグは更新しない（次回のチェックイン時に再試行）
      }
    }

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
