import { NextRequest, NextResponse } from 'next/server';
import { findMemberByMemberId, getMemberById, findMemberByNfcId, createCheckIn, getLatestCheckIn, updateCheckOutTime, markMyPageNotificationSent } from '@/lib/database';
import { sendMyPageAnnouncementEmail } from '@/lib/mailer';
import { loadSettings } from '@/lib/settings';

// 2025年11月6日 23:59:59 (JST) のUTC時刻
const MYPAGE_ANNOUNCEMENT_CUTOFF_DATE = new Date('2025-11-06T23:59:59+09:00');

// member_idまたはデータベースIDでチェックイン
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrCode, memberId, nfcId } = body;

    let member: any = null;

    // memberIdが指定されている場合は、データベースIDから検索
    if (memberId) {
      member = getMemberById(memberId);
    }
    // qrCodeが指定されている場合は、member_idから検索
    else if (qrCode) {
      member = findMemberByMemberId(qrCode) as any;
    }
    // nfcIdが指定されている場合は、NFC IDから検索
    else if (nfcId) {
      member = findMemberByNfcId(nfcId) as any;
      if (!member) {
        return NextResponse.json(
          { error: '未登録のNFCカードです', unregisteredNfcId: nfcId },
          { status: 404 }
        );
      }
    }
    // どれも指定されていない場合はエラー
    else {
      return NextResponse.json({ error: 'メンバーIDが読み取れませんでした' }, { status: 400 });
    }

    if (!member) {
      return NextResponse.json({ error: '登録されていないメンバーIDです' }, { status: 404 });
    }

    // 最新のチェックインレコードを確認
    const latestCheckIn = getLatestCheckIn(member.id);
    const settings = loadSettings();

    let actionType: 'checkin' | 'checkout' | 'checkout_extension' = 'checkin';
    let checkInId = null;
    let stayDurationMinutes: number | null = null;

    if (latestCheckIn) {
      const lastCheckInTime = new Date(latestCheckIn.check_in_time + 'Z').getTime();
      const currentTime = Date.now();

      // チェックアウトされていない場合 -> チェックアウトを実行
      if (!latestCheckIn.check_out_time) {
        // 同じ日のチェックインかどうかを判定（JST基準）
        const lastCheckInJstDate = new Date(lastCheckInTime + 9 * 60 * 60 * 1000).toDateString();
        const currentJstDate = new Date(currentTime + 9 * 60 * 60 * 1000).toDateString();

        if (lastCheckInJstDate === currentJstDate) {
          // 同日の未チェックアウトなのでチェックアウトする
          updateCheckOutTime(latestCheckIn.id);
          actionType = 'checkout';
          checkInId = latestCheckIn.id;
          stayDurationMinutes = Math.round((currentTime - lastCheckInTime) / (60 * 1000));
        } else {
          // 日をまたいでいる場合は、前のチェックインは放置して新規チェックインとする
          checkInId = createCheckIn(member.id);
          actionType = 'checkin';
        }
      } 
      // すでにチェックアウトされている場合
      else {
        const lastCheckOutTime = new Date(latestCheckIn.check_out_time + 'Z').getTime();
        const checkoutIntervalMinutes = settings.checkOutIntervalMinutes !== undefined ? settings.checkOutIntervalMinutes : 10;
        const checkoutIntervalMs = checkoutIntervalMinutes * 60 * 1000;
        const timeDiffFromCheckout = currentTime - lastCheckOutTime;

        // チェックアウトからインターバル時間内 -> チェックアウト時刻を現在時刻に延長（更新）
        if (timeDiffFromCheckout < checkoutIntervalMs) {
          updateCheckOutTime(latestCheckIn.id);
          actionType = 'checkout_extension';
          checkInId = latestCheckIn.id;
          stayDurationMinutes = Math.round((currentTime - lastCheckInTime) / (60 * 1000));
        } 
        // インターバル時間を超えている場合 -> 新規チェックイン
        else {
          // 重複チェックイン防止（前回のチェックインから一定時間未満はエラー）
          const checkInIntervalMinutes = settings.checkInIntervalMinutes !== undefined ? settings.checkInIntervalMinutes : 10;
          const checkInIntervalMs = checkInIntervalMinutes * 60 * 1000;
          const timeDiffFromCheckIn = currentTime - lastCheckInTime;

          if (timeDiffFromCheckIn < checkInIntervalMs) {
            return NextResponse.json(
              { error: 'このメンバーは既にチェックイン済みです。' },
              { status: 429 }
            );
          }

          checkInId = createCheckIn(member.id);
          actionType = 'checkin';
        }
      }
    } else {
      // 過去に一度もチェックインしていない場合
      checkInId = createCheckIn(member.id);
      actionType = 'checkin';
    }

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
      action: actionType,
      checkIn: {
        id: checkInId,
        memberId: member.id,
        memberName: member.name,
        affiliation: member.affiliation,
        email: member.email,
        stayDurationMinutes,
      },
    });
  } catch (error) {
    console.error('Error during check-in:', error);
    return NextResponse.json({ error: 'チェックイン処理中にエラーが発生しました' }, { status: 500 });
  }
}
