import { NextRequest, NextResponse } from 'next/server';
import { createMember, findMemberByEmailAndName, countMembersByEmail, isMemberIdExists, createSurveyResponse, findMemberByMemberId } from '@/lib/database';
import { createMemberSession } from '@/lib/member-auth';
import { sendVerificationEmail } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// 同じメールアドレスで登録可能な最大人数
const MAX_MEMBERS_PER_EMAIL = 3;

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

// 即時本登録・即時ログイン（メール確認は非同期）
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, affiliation, affiliationDetail, email, password, howDidYouKnow, organizationMemberId } = body;

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

        // ユニークなmember_idを即時生成
        const memberId = generateUniqueMemberId();

        // メンバーをデータベースに直接登録 (email_verified = 0)
        const memberDbId = createMember(
            name,
            affiliation,
            affiliationDetail || null,
            email,
            passwordHash,
            memberId,
            organizationMemberId || null,
            0,
            token,
            expiresAt
        );

        // アンケート回答を保存（回答がある場合のみ）
        if (howDidYouKnow) {
            const member = findMemberByMemberId(memberId) as any;
            if (member) {
                createSurveyResponse(
                    memberId,
                    affiliation,
                    howDidYouKnow,
                    member.created_at
                );
            }
        }

        // メンバーログインセッションを即時生成
        await createMemberSession({
            memberId: Number(memberDbId),
            email,
            name,
        });

        // 確認メールを非同期で送信（エラーでもユーザー登録は完了させる）
        sendVerificationEmail(email, name, token)
            .then(() => {
                logger.info('Registration verification email sent', { email, name });
            })
            .catch((mailError) => {
                logger.error('Registration: Email sending error (non-critical)', { email, name, error: mailError });
                console.error('Email sending error:', mailError);
            });

        return NextResponse.json({
            success: true,
            message: 'メンバー登録が完了しました。',
            memberId,
            redirectUrl: '/member/dashboard',
        });
    } catch (error) {
        logger.error('Registration failed: System error', { error });
        console.error('Error in member registration:', error);
        return NextResponse.json({ error: '登録処理中にエラーが発生しました' }, { status: 500 });
    }
}
