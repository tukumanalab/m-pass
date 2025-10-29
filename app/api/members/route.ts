import { NextRequest, NextResponse } from 'next/server';
import { createMember, getAllMembers, isMemberIdExists, findMemberByEmailAndName } from '@/lib/database';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';

// メンバーIDを生成（4桁: 年+英字+数字+英字）
// 発行年の西暦の1桁目（一の位） + ランダムな英文字（小文字） + ランダムな数値 + ランダムな英文字（小文字）
function generateMemberId(): string {
  const currentYear = new Date().getFullYear();
  const yearDigit = currentYear % 10; // 西暦の一の位

  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const randomLetter1 = letters[Math.floor(Math.random() * letters.length)];
  const randomNumber = Math.floor(Math.random() * 10);
  const randomLetter2 = letters[Math.floor(Math.random() * letters.length)];

  return `${yearDigit}${randomLetter1}${randomNumber}${randomLetter2}`;
}

// 重複しないユニークなIDを生成
function generateUniqueMemberId(): string {
  let memberId: string;
  let attempts = 0;
  const maxAttempts = 100; // 無限ループ防止

  do {
    memberId = generateMemberId();
    attempts++;

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique member ID after maximum attempts');
    }
  } while (isMemberIdExists(memberId));

  return memberId;
}

// メンバー一覧を取得
export async function GET() {
  try {
    const members = getAllMembers();
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// メンバーを登録してQRコードを生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, affiliation, affiliationDetail, email, password } = body;

    // バリデーション
    if (!name) {
      return NextResponse.json({ error: '氏名は必須です' }, { status: 400 });
    }
    if (!affiliation) {
      return NextResponse.json({ error: '所属は必須です' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'パスワードは必須です' }, { status: 400 });
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        error: 'メールアドレスの形式が正しくありません'
      }, { status: 400 });
    }

    // メールアドレスと名前での重複チェック
    const existingMember = findMemberByEmailAndName(email, name);
    if (existingMember) {
      return NextResponse.json({
        error: '同じメールアドレスと名前の組み合わせは既に登録されています'
      }, { status: 409 });
    }

    // パスワードの強度チェック（英数記号を含む8文字以上）
    const passwordRegex = /^[A-Za-z\d@$!%*?&_.\-]{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json({
        error: 'パスワードは英数記号を含む8文字以上である必要があります'
      }, { status: 400 });
    }

    // パスワードのハッシュ化
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // ユニークなmember_idを生成（4桁: 年+英字+数字+英字）
    const memberId = generateUniqueMemberId();

    // メンバーをデータベースに登録
    const memberDbId = createMember(
      name,
      affiliation,
      affiliationDetail || null,
      email,
      passwordHash,
      memberId
    );

    // QRコード画像をBase64データURLとして生成（ファイルに保存しない）
    const qrCodeDataUrl = await QRCode.toDataURL(memberId, {
      width: 300,
      margin: 2,
    });

    return NextResponse.json({
      success: true,
      member: {
        id: memberDbId,
        name,
        affiliation,
        affiliationDetail,
        email,
        memberId,
        qrCodeUrl: qrCodeDataUrl, // Base64データURL
      },
    });
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}
