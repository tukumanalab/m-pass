import { NextResponse } from 'next/server';
import { deleteMemberSession } from '@/lib/member-auth';

export async function POST() {
    try {
        await deleteMemberSession();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Member logout error:', error);
        return NextResponse.json(
            { error: 'ログアウトに失敗しました' },
            { status: 500 }
        );
    }
}
