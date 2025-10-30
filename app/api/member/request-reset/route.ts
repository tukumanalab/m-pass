import { NextRequest, NextResponse } from 'next/server';
import { findAllMembersByEmail, createPasswordResetToken, deleteExpiredPasswordResetTokens } from '@/lib/database';
import { sendPasswordResetEmail, sendPasswordResetEmailMultiple } from '@/lib/mailer';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json(
                { error: 'メールアドレスを入力してください' },
                { status: 400 }
            );
        }

        // メールアドレスの形式チェック
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: '有効なメールアドレスを入力してください' },
                { status: 400 }
            );
        }

        // メールアドレスで全メンバーを検索
        const members = findAllMembersByEmail(email) as any[];

        // セキュリティのため、メールアドレスが存在しない場合でも成功レスポンスを返す
        // （アカウントの存在を推測されないようにするため）
        if (!members || members.length === 0) {
            return NextResponse.json({
                message: 'パスワードリセットのメールを送信しました。メールをご確認ください。',
            });
        }

        // 期限切れのトークンを削除
        deleteExpiredPasswordResetTokens();

        // 有効期限を設定（1時間後）
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        const expiresAtStr = expiresAt.toISOString().replace('T', ' ').substring(0, 19);

        // 単一メンバーの場合
        if (members.length === 1) {
            const member = members[0];

            // トークンを生成
            const token = crypto.randomBytes(32).toString('hex');

            // トークンをデータベースに保存
            createPasswordResetToken(member.id, token, expiresAtStr);

            // パスワードリセットメールを送信
            await sendPasswordResetEmail(email, member.name, token);
        } else {
            // 複数メンバーの場合、各メンバーに個別のトークンを生成
            const membersWithTokens = members.map((member) => {
                const token = crypto.randomBytes(32).toString('hex');

                // トークンをデータベースに保存
                createPasswordResetToken(member.id, token, expiresAtStr);

                return {
                    name: member.name,
                    memberId: member.member_id,
                    affiliation: member.affiliation,
                    affiliationDetail: member.affiliation_detail,
                    token,
                };
            });

            // 複数メンバー用のメールを送信
            await sendPasswordResetEmailMultiple(email, membersWithTokens);
        }

        return NextResponse.json({
            message: 'パスワードリセットのメールを送信しました。メールをご確認ください。',
        });
    } catch (error) {
        console.error('Password reset request error:', error);
        return NextResponse.json(
            { error: 'パスワードリセットのリクエストに失敗しました' },
            { status: 500 }
        );
    }
}
