import { NextRequest, NextResponse } from 'next/server';
import db, { createMember, findMemberByEmailAndName, generateUniqueMemberId, addMemberNfcCard, isNfcIdExists } from '@/lib/database';
import { isAdminAuthenticated } from '@/lib/auth';
import bcrypt from 'bcrypt';

// パスワード検証（英数記号を含む8文字以上）
function validatePassword(password: string): boolean {
  return /^[A-Za-z\d@$!%*?&_.\-+=^#~,;:/<>{}[\]|()`'"\\]{8,}$/.test(password);
}

// メンバーを新規登録（NFCカード同時登録対応）
export async function POST(request: NextRequest) {
  try {
    // 1. 管理者認証チェック
    let isAuthenticated = false;
    try {
      isAuthenticated = await isAdminAuthenticated();
    } catch (authError) {
      console.error('Authentication check error:', authError);
      return NextResponse.json(
        { success: false, message: '認証チェックエラーが発生しました' },
        { status: 500 }
      );
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, message: '認証が必要です' },
        { status: 401 }
      );
    }

    // 2. パラメータの取得
    const body = await request.json();
    const { name, affiliation, affiliation_detail, organization_member_id, email, password, nfc_cards } = body;

    // 3. バリデーション
    if (!name || name.trim() === '') {
      return NextResponse.json({ success: false, message: '名前は必須です' }, { status: 400 });
    }
    if (!affiliation || affiliation.trim() === '') {
      return NextResponse.json({ success: false, message: '所属は必須です' }, { status: 400 });
    }
    if (!email || email.trim() === '') {
      return NextResponse.json({ success: false, message: 'メールアドレスは必須です' }, { status: 400 });
    }
    if (!password || password.trim() === '') {
      return NextResponse.json({ success: false, message: 'パスワードは必須です' }, { status: 400 });
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'メールアドレスの形式が正しくありません' },
        { status: 400 }
      );
    }

    // パスワードの強度チェック（英数記号を含む8文字以上）
    if (!validatePassword(password)) {
      return NextResponse.json(
        { success: false, message: 'パスワードは英数記号を含む8文字以上である必要があります' },
        { status: 400 }
      );
    }

    // 4. 重複チェック（メールアドレスと名前での重複）
    const existingMember = findMemberByEmailAndName(email, name);
    if (existingMember) {
      return NextResponse.json(
        { success: false, message: '同じメールアドレスと名前の組み合わせは既に登録されています' },
        { status: 409 }
      );
    }

    // 5. パスワードのハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);

    // 6. ユニークなメンバーIDを自動生成 (4桁)
    const memberId = generateUniqueMemberId();

    // 7. トランザクションによる登録処理 (メンバー + NFCカード)
    let memberDbId: number;
    try {
      const insertTx = db.transaction((memberData, nfcCardsList) => {
        // メンバー登録
        const newId = createMember(
          memberData.name,
          memberData.affiliation,
          memberData.affiliationDetail,
          memberData.email,
          memberData.passwordHash,
          memberData.memberId,
          memberData.organizationMemberId
        ) as number;

        // NFCカード登録
        if (nfcCardsList && nfcCardsList.length > 0) {
          for (const card of nfcCardsList) {
            const cleanNfcId = card.nfc_id.trim().toUpperCase();
            // NFC ID重複チェック
            if (isNfcIdExists(cleanNfcId)) {
              throw new Error(`NFC ID '${cleanNfcId}' は既に他のユーザーに登録されています`);
            }
            addMemberNfcCard(newId, cleanNfcId, card.card_name.trim());
          }
        }
        return newId;
      });

      memberDbId = insertTx(
        {
          name: name.trim(),
          affiliation: affiliation.trim(),
          affiliationDetail: affiliation_detail ? affiliation_detail.trim() : null,
          email: email.trim(),
          passwordHash,
          memberId,
          organizationMemberId: organization_member_id ? organization_member_id.trim() : null
        },
        nfc_cards
      );
    } catch (txError: any) {
      console.error('Transaction failed:', txError);
      return NextResponse.json(
        { success: false, message: txError.message || 'データベース登録中にエラーが発生しました' },
        { status: txError.message?.includes('既に他のユーザーに登録されています') ? 409 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'メンバーを登録しました',
      member: {
        id: memberDbId,
        member_id: memberId,
        name,
        affiliation,
        affiliation_detail,
        organization_member_id,
        email,
      }
    });
  } catch (error) {
    console.error('Create member error:', error);
    return NextResponse.json(
      { success: false, message: 'メンバーの登録中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
