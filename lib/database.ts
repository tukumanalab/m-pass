import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// DB_PATHが指定されていない場合はmembers.db、指定されている場合はDB_PATHを使用
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'members.db');

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
      member_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      affiliation TEXT NOT NULL,
      affiliation_detail TEXT,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      mypage_notification_sent_at DATETIME
    )
  `);

  // 既存のmembersテーブルに新しいカラムを追加（マイグレーション）
  try {
    db.exec(`ALTER TABLE members ADD COLUMN mypage_notification_sent_at DATETIME`);
  } catch (e) {
    // カラムが既に存在する場合はエラーを無視
  }

  // 仮登録メンバーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      affiliation TEXT NOT NULL,
      affiliation_detail TEXT,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // メールアドレス変更申請テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_email_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      new_email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  // パスワードリセットトークンテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);

  // チェックインテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      member_id_str TEXT,
      affiliation TEXT,
      check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
    )
  `);

  // 既存のチェックインテーブルに新しいカラムを追加（マイグレーション）
  try {
    db.exec(`ALTER TABLE checkins ADD COLUMN member_id_str TEXT`);
  } catch (e) {
    // カラムが既に存在する場合はエラーを無視
  }
  try {
    db.exec(`ALTER TABLE checkins ADD COLUMN affiliation TEXT`);
  } catch (e) {
    // カラムが既に存在する場合はエラーを無視
  }

  // 外部キー制約の変更が必要かチェック
  const tableInfo = db.pragma('foreign_key_list(checkins)') as Array<{
    id: number;
    seq: number;
    table: string;
    from: string;
    to: string;
    on_update: string;
    on_delete: string;
    match: string;
  }>;
  const needsFKMigration = tableInfo.some((fk) => 
    fk.table === 'members' && fk.on_delete !== 'SET NULL'
  );

  if (needsFKMigration) {
    console.log('Migrating checkins table foreign key constraint...');
    
    // トランザクション内でテーブルを再作成
    db.exec(`
      BEGIN TRANSACTION;

      -- 一時テーブルを作成
      CREATE TABLE checkins_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        member_id_str TEXT,
        affiliation TEXT,
        check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
      );

      -- データをコピー
      INSERT INTO checkins_new (id, member_id, member_id_str, affiliation, check_in_time)
      SELECT id, member_id, member_id_str, affiliation, check_in_time FROM checkins;

      -- 古いテーブルを削除
      DROP TABLE checkins;

      -- 新しいテーブルをリネーム
      ALTER TABLE checkins_new RENAME TO checkins;

      COMMIT;
    `);
    
    console.log('Foreign key constraint migration completed.');
  }

  // 既存のチェックイン履歴にメンバー情報を埋める（一度だけ実行）
  try {
    const needsMigration = db.prepare(`
      SELECT COUNT(*) as count FROM checkins 
      WHERE member_id IS NOT NULL AND (member_id_str IS NULL OR affiliation IS NULL)
    `).get() as { count: number };

    if (needsMigration.count > 0) {
      console.log(`Migrating ${needsMigration.count} checkin records...`);
      db.exec(`
        UPDATE checkins 
        SET 
          member_id_str = (SELECT member_id FROM members WHERE members.id = checkins.member_id),
          affiliation = (SELECT affiliation FROM members WHERE members.id = checkins.member_id)
        WHERE member_id IS NOT NULL AND (member_id_str IS NULL OR affiliation IS NULL)
      `);
      console.log('Checkin records migration completed.');
    }
  } catch (e) {
    console.error('Migration error (non-critical):', e);
  }

  // member_id用のインデックス
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_member_id ON members(member_id)
  `);

  // token用のインデックス
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_token ON pending_members(token)
  `);

  // password_reset_tokens用のインデックス
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token)
  `);

  // pending_email_changes用のインデックス
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_email_change_token ON pending_email_changes(token)
  `);
}

// メンバーの登録
export function createMember(
  name: string,
  affiliation: string,
  affiliationDetail: string | null,
  email: string,
  passwordHash: string,
  memberId: string
) {
  const stmt = db.prepare(`
    INSERT INTO members (name, affiliation, affiliation_detail, email, password_hash, member_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name, affiliation, affiliationDetail, email, passwordHash, memberId);
  return result.lastInsertRowid;
}

// member_idからメンバーを検索
export function findMemberByMemberId(memberId: string) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE member_id = ?
  `);
  return stmt.get(memberId);
}

// member_idの存在チェック（重複チェック用）
export function isMemberIdExists(memberId: string): boolean {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM members WHERE member_id = ?
  `);
  const result = stmt.get(memberId) as { count: number };
  return result.count > 0;
}

// メールアドレスと名前での重複チェック
export function findMemberByEmailAndName(email: string, name: string) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE email = ? AND name = ?
  `);
  return stmt.get(email, name);
}

// メールアドレスで登録されているメンバー数をカウント
export function countMembersByEmail(email: string): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM members WHERE email = ?
  `);
  const result = stmt.get(email) as { count: number };
  return result.count;
}

// メールアドレスでメンバーを検索（ログイン用）
export function findMemberByEmail(email: string) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE email = ?
  `);
  return stmt.get(email);
}

// メールアドレスで全メンバーを検索（複数対応）
export function findAllMembersByEmail(email: string) {
  const stmt = db.prepare(`
    SELECT * FROM members WHERE email = ? ORDER BY created_at DESC
  `);
  return stmt.all(email);
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
  // メンバー情報を取得
  const member = db.prepare(`
    SELECT member_id, affiliation FROM members WHERE id = ?
  `).get(memberId) as { member_id: string; affiliation: string } | undefined;

  if (!member) {
    throw new Error(`Member with id ${memberId} not found`);
  }

  const stmt = db.prepare(`
    INSERT INTO checkins (member_id, member_id_str, affiliation, check_in_time)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(
    memberId,
    member.member_id,
    member.affiliation
  );
  return result.lastInsertRowid;
}

// チェックインの記録（日時指定、JSTからUTCに変換して保存）
// チェックイン履歴の重複チェック（同じメンバーID・同じ日時）
export function checkDuplicateCheckIn(memberId: number, checkInTime: string): boolean {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM checkins
    WHERE member_id = ? AND check_in_time = datetime(?, '-9 hours')
  `);
  const result = stmt.get(memberId, checkInTime) as { count: number };
  return result.count > 0;
}

export function createCheckInWithTime(memberId: number, checkInTime: string) {
  // メンバー情報を取得
  const member = db.prepare(`
    SELECT member_id, affiliation FROM members WHERE id = ?
  `).get(memberId) as { member_id: string; affiliation: string } | undefined;

  if (!member) {
    throw new Error(`Member with id ${memberId} not found`);
  }

  const stmt = db.prepare(`
    INSERT INTO checkins (member_id, member_id_str, affiliation, check_in_time)
    VALUES (?, ?, ?, datetime(?, '-9 hours'))
  `);
  const result = stmt.run(
    memberId,
    member.member_id,
    member.affiliation,
    checkInTime
  );
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

// 全てのチェックイン履歴を削除
export function deleteAllCheckIns() {
  const stmt = db.prepare(`DELETE FROM checkins`);
  const result = stmt.run();
  return result.changes;
}

// 本日のチェックイン一覧を取得（所属情報はチェックイン時に保存された値を使用）
// UTCで保存されているデータを、JSTの「今日」でフィルタリング
export function getTodayCheckIns() {
  const stmt = db.prepare(`
    SELECT
      id,
      member_id,
      member_id_str,
      affiliation,
      check_in_time
    FROM checkins
    WHERE DATE(datetime(check_in_time, '+9 hours')) = DATE(datetime('now', '+9 hours'))
    ORDER BY check_in_time DESC
  `);
  return stmt.all();
}

// 利用履歴を取得（ページネーション付き、所属情報はチェックイン時に保存された値を使用）
export function getCheckInHistory(limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT
      id,
      member_id,
      member_id_str,
      affiliation,
      check_in_time
    FROM checkins
    ORDER BY check_in_time DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
}

// 特定メンバーのチェックイン履歴を取得
export function getCheckInHistoryByMemberId(memberId: number, limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT
      id,
      member_id,
      member_id_str,
      affiliation,
      check_in_time
    FROM checkins
    WHERE member_id = ?
    ORDER BY check_in_time DESC
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

// 仮登録メンバーの作成
export function createPendingMember(
  token: string,
  name: string,
  affiliation: string,
  affiliationDetail: string | null,
  email: string,
  passwordHash: string,
  expiresAt: string
) {
  const stmt = db.prepare(`
    INSERT INTO pending_members (token, name, affiliation, affiliation_detail, email, password_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(token, name, affiliation, affiliationDetail, email, passwordHash, expiresAt);
  return result.lastInsertRowid;
}

// トークンから仮登録メンバーを取得
export function findPendingMemberByToken(token: string) {
  const stmt = db.prepare(`
    SELECT * FROM pending_members WHERE token = ?
  `);
  return stmt.get(token);
}

// 期限切れの仮登録メンバーを削除
export function deleteExpiredPendingMembers() {
  const stmt = db.prepare(`
    DELETE FROM pending_members WHERE expires_at < CURRENT_TIMESTAMP
  `);
  const result = stmt.run();
  return result.changes;
}

// 仮登録メンバーを削除
export function deletePendingMember(id: number) {
  const stmt = db.prepare(`
    DELETE FROM pending_members WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes;
}

// メールアドレスで仮登録メンバーを検索
export function findPendingMemberByEmail(email: string) {
  const stmt = db.prepare(`
    SELECT * FROM pending_members WHERE email = ?
  `);
  return stmt.get(email);
}

// パスワードリセットトークンの作成
export function createPasswordResetToken(
  memberId: number,
  token: string,
  expiresAt: string
) {
  const stmt = db.prepare(`
    INSERT INTO password_reset_tokens (member_id, token, expires_at)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(memberId, token, expiresAt);
  return result.lastInsertRowid;
}

// トークンからパスワードリセット情報を取得
export function findPasswordResetByToken(token: string) {
  const stmt = db.prepare(`
    SELECT * FROM password_reset_tokens WHERE token = ?
  `);
  return stmt.get(token);
}

// 期限切れのパスワードリセットトークンを削除
export function deleteExpiredPasswordResetTokens() {
  const stmt = db.prepare(`
    DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP
  `);
  const result = stmt.run();
  return result.changes;
}

// パスワードリセットトークンを削除
export function deletePasswordResetToken(id: number) {
  const stmt = db.prepare(`
    DELETE FROM password_reset_tokens WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes;
}

// メンバーのパスワードを更新
export function updateMemberPassword(id: number, passwordHash: string) {
  const stmt = db.prepare(`
    UPDATE members SET password_hash = ? WHERE id = ?
  `);
  return stmt.run(passwordHash, id).changes;
}

// マイページ通知送信済みフラグを更新
export function markMyPageNotificationSent(id: number) {
  const now = new Date().toISOString(); // ISO 8601形式 (YYYY-MM-DDTHH:mm:ss.sssZ)
  const stmt = db.prepare(`
    UPDATE members SET mypage_notification_sent_at = ? WHERE id = ?
  `);
  return stmt.run(now, id).changes;
}

// マイページ通知送信済みフラグをリセット（単一メンバー）
export function resetMyPageNotificationFlag(id: number) {
  const stmt = db.prepare(`
    UPDATE members SET mypage_notification_sent_at = NULL WHERE id = ?
  `);
  return stmt.run(id).changes;
}

// マイページ通知送信済みフラグをリセット（全メンバー）
export function resetAllMyPageNotificationFlags() {
  const stmt = db.prepare(`
    UPDATE members SET mypage_notification_sent_at = NULL
  `);
  return stmt.run().changes;
}

// メールアドレス変更申請の作成
export function createPendingEmailChange(
  memberId: number,
  newEmail: string,
  token: string,
  expiresAt: string
) {
  const stmt = db.prepare(`
    INSERT INTO pending_email_changes (member_id, new_email, token, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(memberId, newEmail, token, expiresAt);
  return result.lastInsertRowid;
}

// トークンからメールアドレス変更申請を取得
export function findPendingEmailChangeByToken(token: string) {
  const stmt = db.prepare(`
    SELECT * FROM pending_email_changes WHERE token = ?
  `);
  return stmt.get(token);
}

// メールアドレス変更申請を削除
export function deletePendingEmailChange(id: number) {
  const stmt = db.prepare(`
    DELETE FROM pending_email_changes WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes;
}

// 期限切れのメールアドレス変更申請を削除
export function deleteExpiredPendingEmailChanges() {
  const stmt = db.prepare(`
    DELETE FROM pending_email_changes WHERE expires_at < CURRENT_TIMESTAMP
  `);
  const result = stmt.run();
  return result.changes;
}

// メンバーIDで保留中のメールアドレス変更申請を削除
export function deletePendingEmailChangeByMemberId(memberId: number) {
  const stmt = db.prepare(`
    DELETE FROM pending_email_changes WHERE member_id = ?
  `);
  const result = stmt.run(memberId);
  return result.changes;
}

// データベース初期化を実行
initDatabase();

export default db;
