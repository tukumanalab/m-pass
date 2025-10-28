import { NextRequest, NextResponse } from 'next/server';
import { createMemberSession, verifyMemberSession } from '@/lib/member-auth';
import { getMemberById, updateMemberProfile } from '@/lib/database';
import bcrypt from 'bcrypt';

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

        return NextResponse.json({
            id: member.id,
            name: member.name,
            email: member.email,
            affiliation: member.affiliation,
            affiliationDetail: member.affiliation_detail,
            memberId: member.member_id,
            createdAt: member.created_at,
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
            email,
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

        if (!name || !email || !affiliation) {
            return NextResponse.json(
                { error: '名前、所属、メールアドレスは必須です' },
                { status: 400 }
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'メールアドレスの形式が正しくありません' },
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

        let passwordHash: string | undefined;
        if (password) {
            if (!/^[A-Za-z\d@$!%*?&_.\-]{8,}$/.test(password)) {
                return NextResponse.json(
                    { error: 'パスワードは英数記号を含む8文字以上である必要があります' },
                    { status: 400 }
                );
            }

            passwordHash = await bcrypt.hash(password, 10);
        }

        updateMemberProfile(session.memberId, {
            name,
            email,
            affiliation,
            affiliationDetail,
            passwordHash,
        });

        await createMemberSession({
            memberId: session.memberId,
            email,
            name,
        });

        const updatedMember = getMemberById(session.memberId) as any;

        return NextResponse.json({
            id: updatedMember.id,
            name: updatedMember.name,
            email: updatedMember.email,
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
