import { NextRequest, NextResponse } from 'next/server';
import { findMemberByMemberId } from '@/lib/database';
import { createMemberSession } from '@/lib/member-auth';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { memberId, password } = body;

        // バリデーション
        if (!memberId || !password) {
            return NextResponse.json(
                { error: 'メンバーIDとパスワードを入力してください' },
                { status: 400 }
            );
        }

        // メンバーを検索
        const member = findMemberByMemberId(memberId.trim()) as any;

        if (!member) {
            return NextResponse.json(
                { error: 'メンバーIDまたはパスワードが正しくありません' },
                { status: 401 }
            );
        }

        // パスワードを検証
        const isPasswordValid = await bcrypt.compare(password, member.password_hash);

        if (!isPasswordValid) {
            return NextResponse.json(
                { error: 'メンバーIDまたはパスワードが正しくありません' },
                { status: 401 }
            );
        }

        // セッションを作成
        await createMemberSession({
            memberId: member.id,
            email: member.email,
            name: member.name,
        });

        return NextResponse.json({
            success: true,
            member: {
                id: member.id,
                name: member.name,
                email: member.email,
                affiliation: member.affiliation,
                affiliationDetail: member.affiliation_detail,
            },
        });
    } catch (error) {
        console.error('Member authentication error:', error);
        // JSONパースエラーの場合
        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'リクエストの形式が正しくありません' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'ログインに失敗しました' },
            { status: 500 }
        );
    }
}
