import { NextRequest, NextResponse } from 'next/server';
import db, { getMemberNfcCards } from '@/lib/database';
import bcrypt from 'bcrypt';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// メンバー情報取得
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // idが数値の場合はinteger ID、そうでない場合はmember_idとして検索
    const isNumericId = /^\d+$/.test(id);
    
    let member: any;
    if (isNumericId) {
      member = db.prepare(`
        SELECT id, member_id, name, affiliation, affiliation_detail, email, created_at, mypage_notification_sent_at
        FROM members
        WHERE id = ?
      `).get(id);
    } else {
      member = db.prepare(`
        SELECT id, member_id, name, affiliation, affiliation_detail, email, created_at, mypage_notification_sent_at
        FROM members
        WHERE member_id = ?
      `).get(id);
    }

    if (!member) {
      return NextResponse.json(
        { success: false, message: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // NFCカードリストを取得
    const nfcCards = getMemberNfcCards(member.id);

    return NextResponse.json({ 
      success: true, 
      member: { 
        ...member, 
        nfc_cards: nfcCards 
      } 
    });
  } catch (error) {
    console.error('Get member error:', error);
    return NextResponse.json(
      { success: false, message: '取得エラーが発生しました' },
      { status: 500 }
    );
  }
}

// メンバー情報更新
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { name, affiliation, affiliation_detail, email, password } = await request.json();

    // バリデーション
    if (!name || !affiliation || !email) {
      return NextResponse.json(
        { success: false, message: '名前、所属、メールアドレスは必須です' },
        { status: 400 }
      );
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'メールアドレスの形式が正しくありません' },
        { status: 400 }
      );
    }

    // パスワードが指定されている場合は更新
    if (password) {
      // パスワード強度チェック
      if (!/^[A-Za-z\d@$!%*?&_.\-+=^#~,;:/<>{}[\]|()`'"\\]{8,}$/.test(password)) {
        return NextResponse.json(
          { success: false, message: 'パスワードは英数記号を含む8文字以上である必要があります' },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      db.prepare(`
        UPDATE members
        SET name = ?, affiliation = ?, affiliation_detail = ?, email = ?, password_hash = ?
        WHERE id = ?
      `).run(name, affiliation, affiliation_detail || '', email, hashedPassword, id);
    } else {
      // パスワードなしで更新
      db.prepare(`
        UPDATE members
        SET name = ?, affiliation = ?, affiliation_detail = ?, email = ?
        WHERE id = ?
      `).run(name, affiliation, affiliation_detail || '', email, id);
    }

    return NextResponse.json({ success: true, message: 'メンバー情報を更新しました' });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json(
      { success: false, message: '更新エラーが発生しました' },
      { status: 500 }
    );
  }
}

// メンバー削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // メンバーの存在確認
    const member = db.prepare('SELECT id, member_id FROM members WHERE id = ?').get(id) as { id: number; member_id: string } | undefined;

    if (!member) {
      return NextResponse.json(
        { success: false, message: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // 関連するチェックイン記録も削除
    db.prepare('DELETE FROM checkins WHERE member_id = ?').run(id);

    // アンケート回答を削除
    db.prepare('DELETE FROM survey_responses WHERE member_id = ?').run(member.member_id);

    // メンバー削除
    db.prepare('DELETE FROM members WHERE id = ?').run(id);

    return NextResponse.json({ success: true, message: 'メンバーを削除しました' });
  } catch (error) {
    console.error('Delete member error:', error);
    return NextResponse.json(
      { success: false, message: '削除エラーが発生しました' },
      { status: 500 }
    );
  }
}
