import { NextRequest, NextResponse } from 'next/server';
import { createPendingMember, findMemberByEmailAndName, countMembersByEmail } from '@/lib/database';
import { sendVerificationEmail } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// 同じメールアドレスで登録可能な最大人数
const MAX_MEMBERS_PER_EMAIL = 3;

// 仮登録してメール送信
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, affiliation, affiliationDetail, email, password, howDidYouKnow } = body;

        // バリデーション
        if (!name) {

            return NextResponse.json({ error: '氏名は必須です' }, { status: 400 });
        }
        if (!affiliation) {

            return NextResponse.json({ error: '所属は必須です' }, { status: 400 });
        }
        if (!email) {

            return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
        }
        if (!password) {

            return NextResponse.json({ error: 'パスワードは必須です' }, { status: 400 });
        }

        // メールアドレスの形式チェック
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {

            return NextResponse.json({
                error: 'メールアドレスの形式が正しくありません'
            }, { status: 400 });
        }

        // 同じメールアドレスで登録されているメンバー数をチェック
        const memberCount = countMembersByEmail(email);
        if (memberCount >= MAX_MEMBERS_PER_EMAIL) {

            return NextResponse.json({
                error: `このメールアドレスでは最大${MAX_MEMBERS_PER_EMAIL}人まで登録できます`
            }, { status: 400 });
        }

        // メールアドレスと名前での重複チェック（既に登録済みのメンバー）
        const existingMember = findMemberByEmailAndName(email, name);
        if (existingMember) {

            return NextResponse.json({
                error: '同じメールアドレスと名前の組み合わせは既に登録されています'
            }, { status: 409 });
        }

        // パスワードの強度チェック（英数記号を含む8文字以上）
        const passwordRegex = /^[A-Za-z\d@$!%*?&_.\-+=^#~,;:/<>{}[\]|()`'"\\]{8,}$/;
        if (!passwordRegex.test(password)) {

            return NextResponse.json({
                error: 'パスワードは英数記号を含む8文字以上である必要があります'
            }, { status: 400 });
        }

        // パスワードのハッシュ化
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 確認用トークンを生成（32バイトのランダム文字列）
        const token = crypto.randomBytes(32).toString('hex');

        // 有効期限（24時間後）
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // 仮登録データをデータベースに保存
        createPendingMember(
            token,
            name,
            affiliation,
            affiliationDetail || null,
            email,
            passwordHash,
            expiresAt,
            howDidYouKnow || null
        );

        // 確認メールを送信
        try {
            await sendVerificationEmail(email, name, token);
            logger.info('Registration verification email sent', { email, name });
        } catch (mailError) {
            logger.error('Registration failed: Email sending error', { email, name, error: mailError });
            console.error('Email sending error:', mailError);
            return NextResponse.json({
                error: 'メールの送信に失敗しました。しばらくしてから再度お試しください。'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: '確認メールを送信しました。メールをご確認ください。',
        });
    } catch (error) {
        logger.error('Registration failed: System error', { error });
        console.error('Error in member registration:', error);
        return NextResponse.json({ error: '登録処理中にエラーが発生しました' }, { status: 500 });
    }
}
