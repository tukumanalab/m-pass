import { NextRequest, NextResponse } from 'next/server';
import { createMemberSession, verifyMemberSession } from '@/lib/member-auth';
import { 
    getMemberById, 
    updateMemberProfile,
    createPendingEmailChange,
    deletePendingEmailChangeByMemberId,
    getMemberNfcCards,
} from '@/lib/database';
import { sendEmailChangeVerificationEmail } from '@/lib/mailer';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { maskEmail } from '@/lib/mask';
import { checkRateLimits, HOUR } from '@/lib/rate-limit';

// パスワードが漏れてマイページに入られても、メールアドレスそのものは取り出せないよう伏せ字で返す
function emailFields(email: string | null | undefined) {
    return { maskedEmail: maskEmail(email), hasEmail: !!email };
}

export async function GET() {
    try {
        const session = await verifyMemberSession();

        if (!session) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        const member = getMemberById(session.memberId) as any;

        if (!member) {
            return NextResponse.json(
                { error: 'メンバーが見つかりません' },
                { status: 404 }
            );
        }

        // NFCカードリストを取得
        const cards = getMemberNfcCards(session.memberId);

        return NextResponse.json({
            id: member.id,
            name: member.name,
            ...emailFields(member.email),
            affiliation: member.affiliation,
            affiliationDetail: member.affiliation_detail,
            memberId: member.member_id,
            createdAt: member.created_at,
            cards: cards,
            emailVerified: member.email_verified === 1,
        });
    } catch (error) {
        console.error('Get member info error:', error);
        return NextResponse.json(
            { error: 'メンバー情報の取得に失敗しました' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await verifyMemberSession();

        if (!session) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            name,
            email: inputEmail,
            affiliation,
            affiliationDetail = null,
            password,
        } = body as {
            name?: string;
            email?: string;
            affiliation?: string;
            affiliationDetail?: string | null;
            password?: string;
        };

        if (!name || !affiliation) {
            return NextResponse.json(
                { error: '名前、所属は必須です' },
                { status: 400 }
            );
        }

        const member = getMemberById(session.memberId) as any;

        if (!member) {
            return NextResponse.json(
                { error: 'メンバーが見つかりません' },
                { status: 404 }
            );
        }

        // 画面には現在のアドレスを出さないため、メール欄が空なら「変更しない」と扱う
        const email = (inputEmail ?? '').trim();

        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return NextResponse.json(
                    { error: 'メールアドレスの形式が正しくありません' },
                    { status: 400 }
                );
            }
        }

        // メールアドレスが入力された場合は確認メールを送信（未入力の場合は変更なし）
        // 現在と同じアドレスでも同じ扱いにする。応答が変わると、推測したアドレスが
        // 現在の登録アドレスと一致するかを確かめられてしまうため。
        const emailChanged = email !== '';
        
        if (emailChanged) {
            // 任意のアドレスへ確認メールを送れるため、送信回数を制限する
            const limited = await checkRateLimits([
                { scope: 'member-email-change', limit: 5, windowMs: HOUR, subject: String(session.memberId) },
            ]);
            if (limited) return limited;

            // 既存の保留中のメールアドレス変更申請を削除
            deletePendingEmailChangeByMemberId(session.memberId);

            // 確認用トークンを生成
            const token = crypto.randomBytes(32).toString('hex');

            // 有効期限（1時間後）
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

            // メールアドレス変更申請を保存
            createPendingEmailChange(
                session.memberId,
                email,
                token,
                expiresAt
            );

            // 確認メールを送信
            try {
                await sendEmailChangeVerificationEmail(email, name, token);
            } catch (mailError) {
                console.error('Email sending error:', mailError);
                return NextResponse.json(
                    { error: 'メールの送信に失敗しました。しばらくしてから再度お試しください。' },
                    { status: 500 }
                );
            }

            // メールアドレス以外の情報を更新
            let passwordHash: string | undefined;
            if (password) {
                if (!/^[A-Za-z\d@$!%*?&_.\-+=^#~,;:/<>{}[\]|()`'"\\]{8,}$/.test(password)) {
                    return NextResponse.json(
                        { error: 'パスワードは英数記号を含む8文字以上である必要があります' },
                        { status: 400 }
                    );
                }

                passwordHash = await bcrypt.hash(password, 10);
            }

            updateMemberProfile(session.memberId, {
                name,
                email: member.email, // メールアドレスは変更しない
                affiliation,
                affiliationDetail,
                passwordHash,
            });

            await createMemberSession({
                memberId: session.memberId,
            });

            const updatedMember = getMemberById(session.memberId) as any;

            return NextResponse.json({
                id: updatedMember.id,
                name: updatedMember.name,
                ...emailFields(updatedMember.email),
                affiliation: updatedMember.affiliation,
                affiliationDetail: updatedMember.affiliation_detail,
                memberId: updatedMember.member_id,
                createdAt: updatedMember.created_at,
                emailChangeRequested: true,
                pendingEmail: email,
            });
        }

        // メールアドレスが変更されない場合は通常の更新
        let passwordHash: string | undefined;
        if (password) {
            if (!/^[A-Za-z\d@$!%*?&_.\-+=^#~,;:/<>{}[\]|()`'"\\]{8,}$/.test(password)) {
                return NextResponse.json(
                    { error: 'パスワードは英数記号を含む8文字以上である必要があります' },
                    { status: 400 }
                );
            }

            passwordHash = await bcrypt.hash(password, 10);
        }

        updateMemberProfile(session.memberId, {
            name,
            email: member.email ?? '',
            affiliation,
            affiliationDetail,
            passwordHash,
        });

        await createMemberSession({
            memberId: session.memberId,
        });

        const updatedMember = getMemberById(session.memberId) as any;

        return NextResponse.json({
            id: updatedMember.id,
            name: updatedMember.name,
            ...emailFields(updatedMember.email),
            affiliation: updatedMember.affiliation,
            affiliationDetail: updatedMember.affiliation_detail,
            memberId: updatedMember.member_id,
            createdAt: updatedMember.created_at,
        });
    } catch (error) {
        console.error('Update member info error:', error);

        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'リクエストの形式が正しくありません' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'メンバー情報の更新に失敗しました' },
            { status: 500 }
        );
    }
}
