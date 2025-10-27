import { NextRequest, NextResponse } from 'next/server';
import { getMemberById } from '@/lib/database';
import QRCode from 'qrcode';

interface Member {
  id: number;
  name: string;
  qr_code: string;
  affiliation: string;
  affiliation_detail: string | null;
  email: string;
  password_hash: string;
  created_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memberId = parseInt(id);

    if (isNaN(memberId)) {
      return NextResponse.json(
        { error: 'Invalid member ID' },
        { status: 400 }
      );
    }

    const member = getMemberById(memberId) as Member | undefined;

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // QRコード画像をBase64データURLとして生成
    const qrCodeDataUrl = await QRCode.toDataURL(member.qr_code, {
      width: 300,
      margin: 2,
    });

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        qr_code: member.qr_code,
        qrCodeUrl: qrCodeDataUrl,
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
