import { NextResponse } from 'next/server';
import { verifyMemberSession } from '@/lib/member-auth';
import { getMemberById } from '@/lib/database';
import QRCode from 'qrcode';

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

        // QRコード画像をBase64データURLとして生成
        const qrCodeDataUrl = await QRCode.toDataURL(member.member_id, {
            width: 300,
            margin: 2,
        });

        return NextResponse.json({
            memberId: member.member_id,
            qrCodeUrl: qrCodeDataUrl,
        });
    } catch (error) {
        console.error('Get member QR code error:', error);
        return NextResponse.json(
            { error: 'QRコードの取得に失敗しました' },
            { status: 500 }
        );
    }
}
