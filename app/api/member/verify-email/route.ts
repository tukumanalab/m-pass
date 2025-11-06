import { NextRequest, NextResponse } from 'next/server';
import {
    findPendingEmailChangeByToken,
    deletePendingEmailChange,
    updateMemberProfile,
    getMemberById,
    deleteExpiredPendingEmailChanges,
} from '@/lib/database';
import { createMemberSession } from '@/lib/member-auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { error: 'トークンが必要です' },
                { status: 400 }
            );
        }

        // 期限切れの申請を削除
        deleteExpiredPendingEmailChanges();

        // トークンから申請を検索
        const pendingChange = findPendingEmailChangeByToken(token) as any;

        if (!pendingChange) {
            return NextResponse.json(
                { error: 'このリンクは無効または期限切れです' },
                { status: 400 }
            );
        }

        // 有効期限チェック
        const expiresAt = new Date(pendingChange.expires_at);
        if (expiresAt < new Date()) {
            deletePendingEmailChange(pendingChange.id);
            return NextResponse.json(
                { error: 'このリンクは期限切れです' },
                { status: 400 }
            );
        }

        // メンバー情報を取得
        const member = getMemberById(pendingChange.member_id) as any;

        if (!member) {
            return NextResponse.json(
                { error: 'メンバーが見つかりません' },
                { status: 404 }
            );
        }

        // メールアドレスを更新
        updateMemberProfile(pendingChange.member_id, {
            name: member.name,
            email: pendingChange.new_email,
            affiliation: member.affiliation,
            affiliationDetail: member.affiliation_detail,
        });

        // セッションを更新
        await createMemberSession({
            memberId: pendingChange.member_id,
            email: pendingChange.new_email,
            name: member.name,
        });

        // 申請を削除
        deletePendingEmailChange(pendingChange.id);

        return NextResponse.json({
            success: true,
            message: 'メールアドレスが更新されました',
        });
    } catch (error) {
        console.error('Email verification error:', error);
        return NextResponse.json(
            { error: 'メールアドレスの変更に失敗しました' },
            { status: 500 }
        );
    }
}
