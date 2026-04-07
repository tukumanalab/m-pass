import { NextRequest, NextResponse } from 'next/server';
import {
    findPendingMemberByToken,
    deletePendingMember,
    createMember,
    isMemberIdExists,
    createSurveyResponse,
    findMemberByMemberId,
} from '@/lib/database';
import { sendRegistrationCompleteEmail } from '@/lib/mailer';
import QRCode from 'qrcode';

// メンバーIDを生成（4桁: 年+英字+数字+英字）
function generateMemberId(): string {
    const currentYear = new Date().getFullYear();
    const yearDigit = currentYear % 10;

    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const randomLetter1 = letters[Math.floor(Math.random() * letters.length)];
    const randomNumber = Math.floor(Math.random() * 10);
    const randomLetter2 = letters[Math.floor(Math.random() * letters.length)];

    return `${yearDigit}${randomLetter1}${randomNumber}${randomLetter2}`;
}

// 重複しないユニークなIDを生成
function generateUniqueMemberId(): string {
    let memberId: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
        memberId = generateMemberId();
        attempts++;

        if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique member ID after maximum attempts');
        }
    } while (isMemberIdExists(memberId));

    return memberId;
}

// トークン検証と本登録
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
        }

        // トークンから仮登録メンバーを取得
        const pendingMember = findPendingMemberByToken(token) as any;

        if (!pendingMember) {
            return NextResponse.json({
                error: '無効なトークンです。リンクが正しいか確認してください。'
            }, { status: 404 });
        }

        // 有効期限をチェック（UTC時刻で比較）
        // SQLiteのCURRENT_TIMESTAMPはUTCを返すため、Zを追加してUTCとして明示
        const expiresAt = new Date(pendingMember.expires_at + 'Z');
        if (expiresAt < new Date()) {
            // 期限切れの仮登録を削除
            deletePendingMember(pendingMember.id);
            return NextResponse.json({
                error: 'リンクの有効期限が切れています。再度登録をやり直してください。'
            }, { status: 410 });
        }

        // ユニークなmember_idを生成
        const memberId = generateUniqueMemberId();

        // メンバーをデータベースに登録
        const memberDbId = createMember(
            pendingMember.name,
            pendingMember.affiliation,
            pendingMember.affiliation_detail,
            pendingMember.email,
            pendingMember.password_hash,
            memberId
        );

        // 仮登録データを削除
        deletePendingMember(pendingMember.id);

        // メンバーの登録時刻を取得してアンケート回答を保存（回答がある場合のみ）
        if (pendingMember.how_did_you_know) {
            const member = findMemberByMemberId(memberId) as any;
            createSurveyResponse(
                memberId,
                pendingMember.affiliation,
                pendingMember.how_did_you_know,
                member.created_at
            );
        }

        // QRコード画像をBase64データURLとして生成
        const qrCodeDataUrl = await QRCode.toDataURL(memberId, {
            width: 300,
            margin: 2,
        });

        // 登録完了メールを送信（非同期、エラーは無視）
        sendRegistrationCompleteEmail(
            pendingMember.email,
            pendingMember.name,
            memberId,
            pendingMember.affiliation
        ).catch(err => {
            console.error('Failed to send registration complete email:', err);
        });

        return NextResponse.json({
            success: true,
            member: {
                id: memberDbId,
                name: pendingMember.name,
                affiliation: pendingMember.affiliation,
                affiliationDetail: pendingMember.affiliation_detail,
                email: pendingMember.email,
                memberId,
                qrCodeUrl: qrCodeDataUrl,
            },
        });
    } catch (error) {
        console.error('Error in member verification:', error);
        return NextResponse.json({
            error: '登録処理中にエラーが発生しました'
        }, { status: 500 });
    }
}
