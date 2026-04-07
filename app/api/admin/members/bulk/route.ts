import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import bcrypt from 'bcrypt';
import { isAdminAuthenticated } from '@/lib/auth';

// 所属の選択肢
const AFFILIATION_OPTIONS = [
  "幼稚園",
  "初等部",
  "中等部",
  "高等部",
  "大学",
  "大学院",
  "教職員",
  "その他",
];

// パスワード検証
function validatePassword(password: string): boolean {
  // 英数記号を含む8文字以上
  return /^[A-Za-z\d@$!%*?&_.\-+=^#~,;:/<>{}[\]|()`'"\\]{8,}$/.test(password);
}

// CSVデータのバリデーション
interface CsvRow {
  email: string;
  name: string;
  affiliation: string;
  affiliation_detail: string;
  member_id: string;
  created_at: string;
  mypage_notification_sent_at?: string; // オプショナル
}

function validateCsvRow(row: CsvRow, lineNumber: number): string | null {
  if (!row.name || row.name.trim() === '') {
    return `行${lineNumber}: 名前が空です`;
  }
  if (!row.affiliation || row.affiliation.trim() === '') {
    return `行${lineNumber}: 所属が空です`;
  }
  // メールアドレスが空でない場合のみバリデーション
  if (row.email && row.email.trim() !== '') {
    // メールアドレスの簡易バリデーション
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      return `行${lineNumber}: メールアドレスの形式が不正です`;
    }
  }
  if (!row.member_id || row.member_id.trim() === '') {
    return `行${lineNumber}: メンバーIDが空です`;
  }
  // メンバーIDが4桁であることをチェック
  if (row.member_id.length !== 4) {
    return `行${lineNumber}: メンバーIDは4桁である必要があります`;
  }
  if (!row.created_at || row.created_at.trim() === '') {
    return `行${lineNumber}: 登録日が空です`;
  }
  // 日付フォーマットチェック (YYYY/MM/DD または YYYY/MM/DD HH:mm:ss)
  if (!/^\d{4}\/\d{1,2}\/\d{1,2}(\s+\d{1,2}:\d{1,2}:\d{1,2})?$/.test(row.created_at)) {
    return `行${lineNumber}: 登録日の形式が不正です (YYYY/MM/DD または YYYY/MM/DD HH:mm:ss形式で入力してください)`;
  }

  return null;
}

// RFC 4180準拠のCSVパース関数
function parseCSVLine(line: string): string[] {
  const columns: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされたダブルクォート
        current += '"';
        i++; // 次の文字をスキップ
      } else {
        // クォートの開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // フィールドの区切り
      columns.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // 最後のフィールドを追加
  columns.push(current.trim());

  return columns;
}

// CSVパース関数
function parseCSV(csvText: string): CsvRow[] {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);

  if (lines.length === 0) {
    throw new Error('CSVファイルが空です');
  }

  // ヘッダー行を確認
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  const hasNotificationColumn = headers.includes('mypage_notification_sent_at');

  // ヘッダー行を除外
  const dataLines = lines.slice(1);

  const rows: CsvRow[] = [];
  for (const line of dataLines) {
    const columns = parseCSVLine(line);

    // カラム数チェック（6列または7列）
    const expectedColumns = hasNotificationColumn ? 7 : 6;
    if (columns.length !== expectedColumns) {
      throw new Error(`列数が不正です。${expectedColumns}列必要ですが${columns.length}列です: ${line}`);
    }

    const row: CsvRow = {
      email: columns[0],
      name: columns[1],
      affiliation: columns[2],
      affiliation_detail: columns[3],
      member_id: columns[4],
      created_at: columns[5],
    };

    // mypage_notification_sent_at カラムがある場合
    if (hasNotificationColumn && columns.length > 6) {
      row.mypage_notification_sent_at = columns[6];
    }

    rows.push(row);
  }

  return rows;
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    let isAuthenticated = false;
    try {
      isAuthenticated = await isAdminAuthenticated();
    } catch (authError) {
      console.error('Authentication check error:', authError);
      return NextResponse.json(
        { success: false, message: '認証チェックエラー' },
        { status: 500 }
      );
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, message: '認証が必要です' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { csvData } = body;

    if (!csvData || typeof csvData !== 'string') {
      return NextResponse.json(
        { success: false, message: 'CSVデータが不正です' },
        { status: 400 }
      );
    }

    // CSVパース
    let rows: CsvRow[];
    try {
      rows = parseCSV(csvData);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: error instanceof Error ? error.message : 'CSVパースエラー'
        },
        { status: 400 }
      );
    }

    // バリデーション
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const error = validateCsvRow(rows[i], i + 2); // +2 for header and 1-based indexing
      if (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'バリデーションエラー',
          errors
        },
        { status: 400 }
      );
    }

    // UPSERT用のSQL（member_idで既存データを更新、なければ挿入）
    const upsertMember = db.prepare(`
      INSERT INTO members (member_id, name, affiliation, affiliation_detail, email, password_hash, created_at, mypage_notification_sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(member_id) DO UPDATE SET
        name = excluded.name,
        affiliation = excluded.affiliation,
        affiliation_detail = excluded.affiliation_detail,
        email = excluded.email,
        password_hash = excluded.password_hash,
        created_at = excluded.created_at,
        mypage_notification_sent_at = excluded.mypage_notification_sent_at
    `);

    const results: {
      success: number;
      updated: number;
      failed: number;
      errors: string[];
      failedRows: Array<{ lineNumber: number; data: CsvRow; reason: string }>;
    } = {
      success: 0,
      updated: 0,
      failed: 0,
      errors: [],
      failedRows: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNumber = i + 2;

      try {
        // 既存データをチェック（統計用）
        const existing = db.prepare('SELECT id FROM members WHERE member_id = ?').get(row.member_id);

        // メールアドレスが空の場合はデフォルト値を生成
        let email = row.email && row.email.trim() !== '' ? row.email.trim() : `tukumanalabmember+id_${row.member_id}@gmail.com`;

        // パスワードはメールアドレスと同じにする
        const password = email;

        // パスワード検証
        if (!validatePassword(password)) {
          results.failed++;
          const errorMsg = `行${lineNumber}: メールアドレスが英数記号8文字以上の条件を満たしていません`;
          results.errors.push(errorMsg);
          results.failedRows.push({ lineNumber, data: row, reason: errorMsg });
          continue;
        }

        // パスワードハッシュ化
        const hashedPassword = await bcrypt.hash(password, 10);

        // created_at: ISO形式の文字列をそのまま使用、またはレガシー形式をISO形式に変換
        let createdAtISO: string;
        if (row.created_at.includes('T') || row.created_at.includes('Z')) {
          // 既にISO形式 (YYYY-MM-DDTHH:mm:ss.sssZ)
          createdAtISO = row.created_at;
        } else if (row.created_at.includes(':')) {
          // レガシー形式: 時刻付き (YYYY/MM/DD HH:mm:ss) - UTCとして扱う
          const [datePart, timePart] = row.created_at.split(' ');
          const [year, month, day] = datePart.split('/').map(Number);
          const [hours, minutes, seconds] = timePart.split(':').map(Number);
          createdAtISO = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0)).toISOString();
        } else {
          // レガシー形式: 時刻なし (YYYY/MM/DD) - 00:00:00 UTCとして扱う
          const [year, month, day] = row.created_at.split('/').map(Number);
          createdAtISO = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
        }

        // mypage_notification_sent_at: ISO形式の文字列をそのまま使用、またはレガシー形式をISO形式に変換
        let notificationSentAtISO: string | null = null;
        if (row.mypage_notification_sent_at && row.mypage_notification_sent_at.trim() !== '') {
          if (row.mypage_notification_sent_at.includes('T') || row.mypage_notification_sent_at.includes('Z')) {
            // 既にISO形式 (YYYY-MM-DDTHH:mm:ss.sssZ)
            notificationSentAtISO = row.mypage_notification_sent_at;
          } else if (row.mypage_notification_sent_at.includes(':')) {
            // レガシー形式: 時刻付き (YYYY/MM/DD HH:mm:ss) - UTCとして扱う
            const [datePart, timePart] = row.mypage_notification_sent_at.split(' ');
            const [year, month, day] = datePart.split('/').map(Number);
            const [hours, minutes, seconds] = timePart.split(':').map(Number);
            notificationSentAtISO = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0)).toISOString();
          } else {
            // レガシー形式: 時刻なし (YYYY/MM/DD) - 00:00:00 UTCとして扱う
            const [year, month, day] = row.mypage_notification_sent_at.split('/').map(Number);
            notificationSentAtISO = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
          }
        }

        // 所属の処理：選択肢にない場合は「その他」にして、所属詳細に元の所属を追加
        let affiliation = row.affiliation.trim();
        let affiliationDetail = row.affiliation_detail ? row.affiliation_detail.trim() : '';
        
        if (!AFFILIATION_OPTIONS.includes(affiliation)) {
          // 所属詳細に元の所属を追加
          affiliationDetail = affiliationDetail 
            ? `${affiliation}: ${affiliationDetail}` 
            : affiliation;
          // 所属を「その他」に変更
          affiliation = "その他";
        }

        // メンバー登録（既存の場合は更新）
        upsertMember.run(
          row.member_id,
          row.name,
          affiliation,
          affiliationDetail,
          email,
          hashedPassword,
          createdAtISO,
          notificationSentAtISO
        );

        if (existing) {
          results.updated++;
        } else {
          results.success++;
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : '不明なエラー';
        const fullErrorMsg = `行${lineNumber}: ${errorMsg}`;
        results.errors.push(fullErrorMsg);
        results.failedRows.push({ lineNumber, data: row, reason: fullErrorMsg });
        console.error(`CSV import error at line ${lineNumber}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.success}件新規登録、${results.updated}件更新、${results.failed}件失敗`,
      results,
    });
  } catch (error) {
    console.error('CSV bulk import error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'CSV一括登録エラー'
      },
      { status: 500 }
    );
  }
}

// 全メンバー一括削除
export async function DELETE(request: NextRequest) {
  try {
    // 認証チェック
    let isAuthenticated = false;
    try {
      isAuthenticated = await isAdminAuthenticated();
    } catch (authError) {
      console.error('Authentication check error:', authError);
      return NextResponse.json(
        { success: false, message: '認証チェックエラー' },
        { status: 500 }
      );
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, message: '認証が必要です' },
        { status: 401 }
      );
    }

    // 削除前のメンバー数を取得
    const countResult = db.prepare('SELECT COUNT(*) as count FROM members').get() as { count: number };
    const memberCount = countResult.count;

    if (memberCount === 0) {
      return NextResponse.json({
        success: true,
        message: '削除するメンバーがいません',
        deletedCount: 0,
      });
    }

    // アンケート回答を全削除
    db.prepare('DELETE FROM survey_responses').run();

    // メンバーを全削除（チェックイン履歴は残す）
    db.prepare('DELETE FROM members').run();

    return NextResponse.json({
      success: true,
      message: `${memberCount}件のメンバーを削除しました（チェックイン履歴は保持されます）`,
      deletedCount: memberCount,
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '一括削除エラー'
      },
      { status: 500 }
    );
  }
}
