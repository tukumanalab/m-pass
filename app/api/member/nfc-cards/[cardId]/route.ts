import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberSession } from '@/lib/member-auth';
import { 
  deleteMemberNfcCard, 
  updateMemberNfcCardName, 
  getMemberNfcCards
} from '@/lib/database';

interface RouteParams {
  params: Promise<{ cardId: string }>;
}

// 自分のNFCカードの編集・削除
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await verifyMemberSession();

    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { cardId: cardIdStr } = await params;
    const cardId = parseInt(cardIdStr, 10);
    if (isNaN(cardId)) {
      return NextResponse.json({ error: '不正なカードIDです' }, { status: 400 });
    }

    // 所有者チェック
    const cards = getMemberNfcCards(session.memberId);
    const hasCard = cards.some(c => c.id === cardId);
    if (!hasCard) {
      return NextResponse.json({ error: 'このカードを編集する権限がありません' }, { status: 403 });
    }

    const { cardName } = await request.json();
    if (!cardName) {
      return NextResponse.json({ error: 'カード名は必須です' }, { status: 400 });
    }

    updateMemberNfcCardName(cardId, cardName.trim());

    return NextResponse.json({
      success: true,
      message: 'カード名を変更しました'
    });
  } catch (error) {
    console.error('Member update NFC card error:', error);
    return NextResponse.json({ error: 'カードの更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await verifyMemberSession();

    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { cardId: cardIdStr } = await params;
    const cardId = parseInt(cardIdStr, 10);
    if (isNaN(cardId)) {
      return NextResponse.json({ error: '不正なカードIDです' }, { status: 400 });
    }

    // 所有者チェック
    const cards = getMemberNfcCards(session.memberId);
    const hasCard = cards.some(c => c.id === cardId);
    if (!hasCard) {
      return NextResponse.json({ error: 'このカードを削除する権限がありません' }, { status: 403 });
    }

    deleteMemberNfcCard(cardId);

    return NextResponse.json({
      success: true,
      message: 'NFCカードを削除しました'
    });
  } catch (error) {
    console.error('Member delete NFC card error:', error);
    return NextResponse.json({ error: 'カードの削除に失敗しました' }, { status: 500 });
  }
}
