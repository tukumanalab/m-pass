import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { 
  getMemberById, 
  addMemberNfcCard, 
  deleteMemberNfcCard, 
  updateMemberNfcCardName, 
  isNfcIdExists,
  getMemberNfcCards
} from '@/lib/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 認証チェックユーティリティ
async function checkAuth() {
  try {
    return await isAdminAuthenticated();
  } catch (error) {
    console.error('Admin auth check error:', error);
    return false;
  }
}

// NFCカード追加
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await checkAuth())) {
      return NextResponse.json({ success: false, message: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;
    const memberId = parseInt(id, 10);
    if (isNaN(memberId)) {
      return NextResponse.json({ success: false, message: '不正なメンバーIDです' }, { status: 400 });
    }

    const member = getMemberById(memberId);
    if (!member) {
      return NextResponse.json({ success: false, message: 'メンバーが見つかりません' }, { status: 404 });
    }

    const { nfcId, cardName } = await request.json();
    if (!nfcId || !cardName) {
      return NextResponse.json({ success: false, message: 'NFC IDとカード名は必須です' }, { status: 400 });
    }

    const normalizedNfcId = nfcId.trim().toUpperCase();
    const cleanCardName = cardName.trim();

    if (isNfcIdExists(normalizedNfcId)) {
      return NextResponse.json({ success: false, message: 'このNFCカードは既に登録されています' }, { status: 409 });
    }

    const cardId = addMemberNfcCard(memberId, normalizedNfcId, cleanCardName);

    return NextResponse.json({ 
      success: true, 
      message: 'NFCカードを登録しました',
      card: {
        id: cardId,
        member_id: memberId,
        nfc_id: normalizedNfcId,
        card_name: cleanCardName
      }
    });
  } catch (error) {
    console.error('Add NFC card error:', error);
    return NextResponse.json({ success: false, message: '登録エラーが発生しました' }, { status: 500 });
  }
}

// NFCカード名変更
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await checkAuth())) {
      return NextResponse.json({ success: false, message: '認証が必要です' }, { status: 401 });
    }

    const { cardId, cardName } = await request.json();
    if (!cardId || !cardName) {
      return NextResponse.json({ success: false, message: 'カードIDと新しいカード名は必須です' }, { status: 400 });
    }

    const changes = updateMemberNfcCardName(cardId, cardName.trim());
    if (changes === 0) {
      return NextResponse.json({ success: false, message: 'カードが見つからないか、変更されませんでした' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'カード名を変更しました' });
  } catch (error) {
    console.error('Update NFC card error:', error);
    return NextResponse.json({ success: false, message: '更新エラーが発生しました' }, { status: 500 });
  }
}

// NFCカード削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await checkAuth())) {
      return NextResponse.json({ success: false, message: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardIdStr = searchParams.get('cardId');
    
    if (!cardIdStr) {
      return NextResponse.json({ success: false, message: 'カードIDは必須です' }, { status: 400 });
    }

    const cardId = parseInt(cardIdStr, 10);
    if (isNaN(cardId)) {
      return NextResponse.json({ success: false, message: '不正なカードIDです' }, { status: 400 });
    }

    const changes = deleteMemberNfcCard(cardId);
    if (changes === 0) {
      return NextResponse.json({ success: false, message: 'カードが見つかりませんでした' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'NFCカードを削除しました' });
  } catch (error) {
    console.error('Delete NFC card error:', error);
    return NextResponse.json({ success: false, message: '削除エラーが発生しました' }, { status: 500 });
  }
}
