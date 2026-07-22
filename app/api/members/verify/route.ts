import { NextRequest, NextResponse } from 'next/server';
import {
    findMemberByVerificationToken,
    markEmailAsVerified,
    findPendingMemberByToken,
    deletePendingMember,
    createMember,
    isMemberIdExists,
    createSurveyResponse,
    findMemberByMemberId,
} from '@/lib/database';
import { sendRegistrationCompleteEmail } from '@/lib/mailer';
import { createMemberSession } from '@/lib/member-auth';
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

// トークン検証とメール確認完了
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
        }

        // 1. まず members テーブルからトークンを検索（新方式: 即時利用＋後確認）
        const member = findMemberByVerificationToken(token) as any;

        if (member) {
            // 有効期限をチェック
            if (member.verification_expires_at) {
                const expiresAt = new Date(member.verification_expires_at + (member.verification_expires_at.endsWith('Z') ? '' : 'Z'));
                if (expiresAt < new Date()) {
                    return NextResponse.json({
                        error: '確認リンクの有効期限が切れています。マイページから確認メールを再送してください。'
                    }, { status: 410 });
                }
            }

            // メールアドレスを検証済みに更新
            markEmailAsVerified(member.id);

            // ログインセッションを発行
            await createMemberSession({
                memberId: member.id,
                email: member.email,
                name: member.name,
            });

            // QRコード画像をBase64データURLとして生成
            const qrCodeDataUrl = await QRCode.toDataURL(member.member_id, {
                width: 300,
                margin: 2,
            });

            return NextResponse.json({
                success: true,
                message: 'メールアドレスの確認が完了しました！',
                member: {
                    id: member.id,
                    name: member.name,
                    affiliation: member.affiliation,
                    affiliationDetail: member.affiliation_detail,
                    organizationMemberId: member.organization_member_id,
                    email: member.email,
                    memberId: member.member_id,
                    qrCodeUrl: qrCodeDataUrl,
                },
            });
        }

        // 2. もし members に無ければ、旧方式の pending_members を検索（互換性担保）
        const pendingMember = findPendingMemberByToken(token) as any;

        if (!pendingMember) {
            return NextResponse.json({
                error: '無効なトークンです。リンクが正しいか確認してください。'
            }, { status: 404 });
        }

        // 有効期限をチェック（UTC時刻で比較）
        const expiresAt = new Date(pendingMember.expires_at + (pendingMember.expires_at.endsWith('Z') ? '' : 'Z'));
        if (expiresAt < new Date()) {
            deletePendingMember(pendingMember.id);
            return NextResponse.json({
                error: 'リンクの有効期限が切れています。再度登録をやり直してください。'
            }, { status: 410 });
        }

        // ユニークなmember_idを生成して本登録
        const memberId = generateUniqueMemberId();
        const memberDbId = createMember(
            pendingMember.name,
            pendingMember.affiliation,
            pendingMember.affiliation_detail,
            pendingMember.email,
            pendingMember.password_hash,
            memberId,
            pendingMember.organization_member_id,
            1 // メール検証済みとして登録
        );

        deletePendingMember(pendingMember.id);

        // ログインセッションを発行
        await createMemberSession({
            memberId: memberDbId as number,
            email: pendingMember.email,
            name: pendingMember.name,
        });

        if (pendingMember.how_did_you_know) {
            const newMember = findMemberByMemberId(memberId) as any;
            if (newMember) {
                createSurveyResponse(
                    memberId,
                    pendingMember.affiliation,
                    pendingMember.how_did_you_know,
                    newMember.created_at
                );
            }
        }

        const qrCodeDataUrl = await QRCode.toDataURL(memberId, {
            width: 300,
            margin: 2,
        });

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
            message: 'メールアドレスの確認が完了しました！',
            member: {
                id: memberDbId,
                name: pendingMember.name,
                affiliation: pendingMember.affiliation,
                affiliationDetail: pendingMember.affiliation_detail,
                organizationMemberId: pendingMember.organization_member_id,
                email: pendingMember.email,
                memberId,
                qrCodeUrl: qrCodeDataUrl,
            },
        });
    } catch (error) {
        console.error('Error in member verification:', error);
        return NextResponse.json({
            error: '登録確認処理中にエラーが発生しました'
        }, { status: 500 });
    }
}
