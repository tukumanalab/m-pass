import { NextRequest, NextResponse } from 'next/server';
import { findPasswordResetByToken, deletePasswordResetToken, updateMemberPassword, getMemberById } from '@/lib/database';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, password } = body;

        if (!token || !password) {
            return NextResponse.json(
                { error: 'トークンとパスワードが必要です' },
                { status: 400 }
            );
        }

        // パスワードの強度チェック（最小6文字）
        if (password.length < 6) {
            return NextResponse.json(
                { error: 'パスワードは6文字以上で設定してください' },
                { status: 400 }
            );
        }

        // トークンを検証
        const resetToken = findPasswordResetByToken(token) as any;

        if (!resetToken) {
            return NextResponse.json(
                { error: '無効なトークンです' },
                { status: 400 }
            );
        }

        // 有効期限をチェック（UTC時刻で比較）
        // SQLiteのCURRENT_TIMESTAMPはUTCを返すため、両方をUTCとして扱う
        const expiresAt = new Date(resetToken.expires_at + 'Z'); // Zを追加してUTCとして明示
        const now = new Date();

        console.log('Password reset token check:', {
            token: token.substring(0, 10) + '...',
            expiresAt: expiresAt.toISOString(),
            now: now.toISOString(),
            expired: now > expiresAt
        });

        if (now > expiresAt) {
            // 期限切れのトークンを削除
            deletePasswordResetToken(resetToken.id);
            return NextResponse.json(
                { error: 'トークンの有効期限が切れています。もう一度パスワードリセットをリクエストしてください。' },
                { status: 400 }
            );
        }

        // メンバーを取得
        const member = getMemberById(resetToken.member_id) as any;

        if (!member) {
            return NextResponse.json(
                { error: 'メンバーが見つかりません' },
                { status: 404 }
            );
        }

        // パスワードをハッシュ化
        const passwordHash = await bcrypt.hash(password, 10);

        // パスワードを更新
        updateMemberPassword(member.id, passwordHash);

        // 使用済みのトークンを削除
        deletePasswordResetToken(resetToken.id);

        return NextResponse.json({
            message: 'パスワードが正常にリセットされました',
        });
    } catch (error) {
        console.error('Password reset error:', error);
        return NextResponse.json(
            { error: 'パスワードのリセットに失敗しました' },
            { status: 500 }
        );
    }
}
