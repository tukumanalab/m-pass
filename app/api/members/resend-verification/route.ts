import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberSession } from '@/lib/member-auth';
import { getMemberById, findMemberByEmail, updateVerificationToken } from '@/lib/database';
import { sendVerificationEmail } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { checkRateLimits, HOUR } from '@/lib/rate-limit';

// 未ログイン時の応答（登録の有無・確認状態にかかわらず同じ文言にする）
const UNAUTHENTICATED_MESSAGE =
    '該当するアカウントがあり、メールアドレスが未確認の場合は確認メールを送信しました。メールボックスをご確認ください。';

// 新しい確認用トークン（有効期限24時間）を発行して確認メールを送る
async function sendNewVerificationEmail(member: { id: number; email: string; name: string }) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    updateVerificationToken(member.id, token, expiresAt);
    await sendVerificationEmail(member.email, member.name, token);
    logger.info('Resent verification email', { memberId: member.id });
}

// 確認メールの再送信
export async function POST(request: NextRequest) {
    try {
        const session = await verifyMemberSession();

        if (!session) {
            const body = await request.json().catch(() => ({}));
            const { email } = body;
            if (!email || typeof email !== 'string') {
                return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 });
            }

            // 登録有無の総当たり確認や、特定アドレスへの大量送信を防ぐ
            const limited = await checkRateLimits([
                { scope: 'resend-verification', limit: 10, windowMs: HOUR },
                { scope: 'resend-verification', limit: 3, windowMs: HOUR, subject: email },
            ]);
            if (limited) return limited;

            // 応答時間の差で登録有無が分からないよう、送信は待たずに同じ応答を返す
            const target = findMemberByEmail(email) as any;
            if (target && target.email_verified !== 1) {
                sendNewVerificationEmail(target).catch((mailError) => {
                    logger.error('Failed to resend verification email', { memberId: target.id, error: String(mailError) });
                });
            }
            return NextResponse.json({ success: true, message: UNAUTHENTICATED_MESSAGE });
        }

        // ログイン中は本人のアカウントなので、状態をそのまま返してよい
        const member = getMemberById(session.memberId) as any;
        if (!member) {
            return NextResponse.json({
                error: '対象のアカウントが見つかりません。再度ログインしてください。'
            }, { status: 404 });
        }

        if (member.email_verified === 1) {
            return NextResponse.json({
                message: 'このメールアドレスは既に確認済みです。',
                alreadyVerified: true,
            });
        }

        try {
            await sendNewVerificationEmail(member);
        } catch (mailError) {
            logger.error('Failed to resend verification email', { memberId: member.id, error: String(mailError) });
            return NextResponse.json({
                error: '確認メールの送信に失敗しました。しばらく時間をおいて再度お試しください。'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: '確認メールを再送信しました。メールボックスをご確認ください。'
        });
    } catch (error) {
        logger.error('Error in resend verification API', { error: String(error) });
        console.error('Error in resend verification API:', error);
        return NextResponse.json({ error: '送信処理中にエラーが発生しました' }, { status: 500 });
    }
}
