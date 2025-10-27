import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// DB_PATHが指定されていない場合、BASE_PATHから自動生成
function getDefaultDbPath(): string {
  const basePath = process.env.BASE_PATH;
  if (basePath) {
    // BASE_PATHから/を削除してDB名を生成 (例: /members -> checkin-members.db)
    const suffix = basePath.replace(/^\//, '').replace(/\//g, '-');
    return path.join(process.cwd(), `checkin-${suffix}.db`);
  }
  return path.join(process.cwd(), 'checkin.db');
}

const dbPath = process.env.DB_PATH || getDefaultDbPath();

// データベースファイルのディレクトリが存在しない場合は作成
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// 外部キー制約を有効化
db.pragma('foreign_keys = ON');

// データベースの初期化
export function initDatabase() {
  // メンバーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      affiliation TEXT NOT NULL,
      affiliation_detail TEXT,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      qr_code TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // チェックインテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `);

  // QRコード用のインデックス
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_qr_code ON members(qr_code)
  `);
}

// メンバーの登録
export function createMember(
  name: string,
  affiliation: string,
  affiliationDetail: string | null,
  email: string,
  passwordHash: string,
  qrCode: string
) {
  const stmt = db.prepare(`
    INSERT INTO members (name, affiliation, affiliation_detail, email, password_hash, qr_code)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name, affiliation, affiliationDetail, email, passwordHash, qrCode);
  return result.lastInsertRowid;
}

// QRコードからメンバーを検索
export function findMemberByQRCode(qrCode: string) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE qr_code = ?
  `);
  return stmt.get(qrCode);
}

// QRコードの存在チェック（重複チェック用）
export function isQRCodeExists(qrCode: string): boolean {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM members WHERE qr_code = ?
  `);
  const result = stmt.get(qrCode) as { count: number };
  return result.count > 0;
}

// メールアドレスと名前での重複チェック
export function findMemberByEmailAndName(email: string, name: string) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE email = ? AND name = ?
  `);
  return stmt.get(email, name);
}

// メールアドレスでメンバーを検索（ログイン用）
export function findMemberByEmail(email: string) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE email = ?
  `);
  return stmt.get(email);
}

// 名前でメンバーを検索
export function findMemberByName(name: string) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE name = ?
  `);
  return stmt.get(name);
}

// 名前でメンバーを検索（空白文字を正規化して検索）
export function findMemberByNameNormalized(name: string) {
  // 検索対象の名前の空白文字を削除
  const normalizedSearchName = name.replace(/[\s\u3000]+/g, '');

  // 全メンバーを取得して、空白文字を削除した名前で比較
  const stmt = db.prepare(`SELECT * FROM members`);
  const members = stmt.all() as Array<{ id: number; name: string }>;

  for (const member of members) {
    const normalizedMemberName = member.name.replace(/[\s\u3000]+/g, '');
    if (normalizedMemberName === normalizedSearchName) {
      return member;
    }
  }

  return undefined;
}

// 最新のチェックイン時刻を取得（1時間制限チェック用）
export function getLatestCheckIn(memberId: number) {
  const stmt = db.prepare(`
    SELECT check_in_time FROM checkins
    WHERE member_id = ?
    ORDER BY check_in_time DESC
    LIMIT 1
  `);
  return stmt.get(memberId) as { check_in_time: string } | undefined;
}

// チェックインの記録（UTCで保存）
export function createCheckIn(memberId: number) {
  const stmt = db.prepare(`
    INSERT INTO checkins (member_id, check_in_time)
    VALUES (?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(memberId);
  return result.lastInsertRowid;
}

// チェックインの記録（日時指定、JSTからUTCに変換して保存）
export function createCheckInWithTime(memberId: number, checkInTime: string) {
  const stmt = db.prepare(`
    INSERT INTO checkins (member_id, check_in_time)
    VALUES (?, datetime(?, '-9 hours'))
  `);
  const result = stmt.run(memberId, checkInTime);
  return result.lastInsertRowid;
}

// チェックイン履歴の削除
export function deleteCheckIns(ids: number[]) {
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`
    DELETE FROM checkins WHERE id IN (${placeholders})
  `);
  const result = stmt.run(...ids);
  return result.changes;
}

// 日付範囲指定でチェックイン履歴を削除
export function deleteCheckInsByDateRange(startDate: string, endDate: string) {
  const stmt = db.prepare(`
    DELETE FROM checkins
    WHERE DATE(datetime(check_in_time, '+9 hours')) >= DATE(?)
      AND DATE(datetime(check_in_time, '+9 hours')) <= DATE(?)
  `);
  const result = stmt.run(startDate, endDate);
  return result.changes;
}

// 本日のチェックイン一覧を取得（所属情報をJOINで取得）
// UTCで保存されているデータを、JSTの「今日」でフィルタリング
export function getTodayCheckIns() {
  const stmt = db.prepare(`
    SELECT
      c.*,
      m.affiliation,
      m.affiliation_detail
    FROM checkins c
    LEFT JOIN members m ON c.member_id = m.id
    WHERE DATE(datetime(c.check_in_time, '+9 hours')) = DATE(datetime('now', '+9 hours'))
    ORDER BY c.check_in_time DESC
  `);
  return stmt.all();
}

// 利用履歴を取得（ページネーション付き、所属情報をJOINで取得）
export function getCheckInHistory(limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT
      c.*,
      m.qr_code,
      m.affiliation,
      m.affiliation_detail
    FROM checkins c
    LEFT JOIN members m ON c.member_id = m.id
    ORDER BY c.check_in_time DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
}

// 特定メンバーのチェックイン履歴を取得
export function getCheckInHistoryByMemberId(memberId: number, limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT
      c.*,
      m.qr_code,
      m.affiliation,
      m.affiliation_detail
    FROM checkins c
    LEFT JOIN members m ON c.member_id = m.id
    WHERE c.member_id = ?
    ORDER BY c.check_in_time DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(memberId, limit, offset);
}

// 全メンバーを取得
export function getAllMembers() {
  const stmt = db.prepare(`
    SELECT * FROM members
    ORDER BY created_at DESC
  `);
  return stmt.all();
}

// IDからメンバーを取得
export function getMemberById(id: number) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE id = ?
  `);
  return stmt.get(id);
}

// メンバー情報の更新
export function updateMemberProfile(
  id: number,
  {
    name,
    affiliation,
    affiliationDetail,
    email,
    passwordHash,
  }: {
    name: string;
    affiliation: string;
    affiliationDetail: string | null;
    email: string;
    passwordHash?: string;
  }
) {
  if (passwordHash) {
    const stmtWithPassword = db.prepare(`
      UPDATE members
      SET name = ?, affiliation = ?, affiliation_detail = ?, email = ?, password_hash = ?
      WHERE id = ?
    `);
    return stmtWithPassword.run(
      name,
      affiliation,
      affiliationDetail ?? '',
      email,
      passwordHash,
      id
    ).changes;
  }

  const stmt = db.prepare(`
    UPDATE members
    SET name = ?, affiliation = ?, affiliation_detail = ?, email = ?
    WHERE id = ?
  `);
  return stmt.run(name, affiliation, affiliationDetail ?? '', email, id).changes;
}

// データベース初期化を実行
initDatabase();

export default db;
