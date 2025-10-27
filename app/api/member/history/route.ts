import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberSession } from '@/lib/member-auth';
import { getCheckInHistoryByMemberId } from '@/lib/database';

export async function GET(request: NextRequest) {
    try {
        const session = await verifyMemberSession();

        if (!session) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const history = getCheckInHistoryByMemberId(session.memberId, limit, offset);

        return NextResponse.json({
            history,
            limit,
            offset,
        });
    } catch (error) {
        console.error('Get member checkin history error:', error);
        return NextResponse.json(
            { error: 'チェックイン履歴の取得に失敗しました' },
            { status: 500 }
        );
    }
}
