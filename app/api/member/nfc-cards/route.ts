import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberSession } from '@/lib/member-auth';
import { 
  addMemberNfcCard, 
  isNfcIdExists,
  getMemberNfcCards
} from '@/lib/database';

// 自分のNFCカードを追加する
export async function POST(request: NextRequest) {
  try {
    const session = await verifyMemberSession();

    if (!session) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { nfcId, cardName } = await request.json();
    if (!nfcId || !cardName) {
      return NextResponse.json(
        { error: 'NFC IDとカード名は必須です' },
        { status: 400 }
      );
    }

    const normalizedNfcId = nfcId.trim().toUpperCase();
    const cleanCardName = cardName.trim();

    // 既に登録されているかチェック
    if (isNfcIdExists(normalizedNfcId)) {
      return NextResponse.json(
        { error: 'このNFCカードは既に登録されています' },
        { status: 409 }
      );
    }

    // 登録枚数制限チェック（最大5枚まで）
    const existingCards = getMemberNfcCards(session.memberId);
    if (existingCards.length >= 5) {
      return NextResponse.json(
        { error: '登録できるNFCカードは最大5枚までです' },
        { status: 400 }
      );
    }

    const cardId = addMemberNfcCard(session.memberId, normalizedNfcId, cleanCardName);

    return NextResponse.json({
      success: true,
      message: 'NFCカードを登録しました',
      card: {
        id: cardId,
        member_id: session.memberId,
        nfc_id: normalizedNfcId,
        card_name: cleanCardName
      }
    });
  } catch (error) {
    console.error('Member add NFC card error:', error);
    return NextResponse.json(
      { error: 'NFCカードの追加に失敗しました' },
      { status: 500 }
    );
  }
}
