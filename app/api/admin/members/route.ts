import { NextRequest, NextResponse } from 'next/server';
import { createMember, findMemberByEmailAndName, generateUniqueMemberId } from '@/lib/database';
import { isAdminAuthenticated } from '@/lib/auth';
import bcrypt from 'bcrypt';

// パスワード検証（英数記号を含む8文字以上）
function validatePassword(password: string): boolean {
  return /^[A-Za-z\d@$!%*?&_.\-+=^#~,;:/<>{}[\]|()`'"\\]{8,}$/.test(password);
}

// メンバーを新規登録
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
    const { name, affiliation, affiliation_detail, organization_member_id, email, password } = body;

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

    // 7. メンバーをデータベースに登録
    const memberDbId = createMember(
      name.trim(),
      affiliation.trim(),
      affiliation_detail ? affiliation_detail.trim() : null,
      email.trim(),
      passwordHash,
      memberId,
      organization_member_id ? organization_member_id.trim() : null
    );

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
