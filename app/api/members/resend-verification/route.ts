import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberSession } from '@/lib/member-auth';
import { getMemberById, findMemberByEmail, updateVerificationToken } from '@/lib/database';
import { sendVerificationEmail } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// 確認メールの再送信
export async function POST(request: NextRequest) {
    try {
        const session = await verifyMemberSession();
        let member: any = null;

        if (session) {
            member = getMemberById(session.memberId);
        } else {
            const body = await request.json().catch(() => ({}));
            const { email } = body;
            if (email) {
                member = findMemberByEmail(email);
            }
        }

        if (!member) {
            return NextResponse.json({
                error: '対象のアカウントが見つかりません。ログインするかメールアドレスをご確認ください。'
            }, { status: 404 });
        }

        if (member.email_verified === 1) {
            return NextResponse.json({
                message: 'このメールアドレスは既に確認済みです。',
                alreadyVerified: true,
            });
        }

        // 新しい確認用トークンと有効期限（24時間）を発行
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        updateVerificationToken(member.id, token, expiresAt);

        // メール再送信
        try {
            await sendVerificationEmail(member.email, member.name, token);
            logger.info('Resent verification email', { memberId: member.id, email: member.email });
        } catch (mailError) {
            logger.error('Failed to resend verification email', { memberId: member.id, error: mailError });
            return NextResponse.json({
                error: '確認メールの送信に失敗しました。しばらく時間をおいて再度お試しください。'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: '確認メールを再送信しました。メールボックスをご確認ください。'
        });
    } catch (error) {
        logger.error('Error in resend verification API', { error });
        console.error('Error in resend verification API:', error);
        return NextResponse.json({ error: '送信処理中にエラーが発生しました' }, { status: 500 });
    }
}
