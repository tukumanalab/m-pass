#!/usr/bin/env node
/**
 * データベースマイグレーションスクリプト
 * qr_code カラムを member_id に変更
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DB_PATHが指定されていない場合、BASE_PATHから自動生成
function getDefaultDbPath() {
  const basePath = process.env.BASE_PATH;
  if (basePath) {
    const suffix = basePath.replace(/^\//, '').replace(/\//g, '-');
    return path.join(process.cwd(), `checkin-${suffix}.db`);
  }
  return path.join(process.cwd(), 'checkin.db');
}

const dbPath = process.env.DB_PATH || getDefaultDbPath();

console.log('データベースマイグレーションを開始します...');
console.log(`データベースファイル: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error('エラー: データベースファイルが見つかりません');
  process.exit(1);
}

// バックアップを作成
const backupPath = dbPath + '.backup.' + Date.now();
console.log(`バックアップを作成中: ${backupPath}`);
fs.copyFileSync(dbPath, backupPath);

const db = new Database(dbPath);

try {
  // トランザクション開始
  db.exec('BEGIN TRANSACTION');

  // 既存のテーブル構造を確認
  const tableInfo = db.prepare("PRAGMA table_info(members)").all();
  const hasQrCode = tableInfo.some(col => col.name === 'qr_code');
  const hasMemberId = tableInfo.some(col => col.name === 'member_id');

  console.log('現在のテーブル構造:');
  console.log('  qr_code カラム:', hasQrCode ? '存在' : '未存在');
  console.log('  member_id カラム:', hasMemberId ? '存在' : '未存在');

  if (!hasQrCode && hasMemberId) {
    console.log('マイグレーションは既に完了しています。');
    db.exec('ROLLBACK');
    process.exit(0);
  }

  if (!hasQrCode) {
    console.error('エラー: qr_code カラムが見つかりません');
    db.exec('ROLLBACK');
    process.exit(1);
  }

  console.log('\nマイグレーションを実行中...');

  // 1. 新しいテーブルを作成
  console.log('1. 新しいテーブルを作成...');
  db.exec(`
    CREATE TABLE members_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      affiliation TEXT NOT NULL,
      affiliation_detail TEXT,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. データを移行（qr_code → member_id）
  console.log('2. データを移行中...');
  const result = db.exec(`
    INSERT INTO members_new (id, member_id, name, affiliation, affiliation_detail, email, password_hash, created_at)
    SELECT id, qr_code, name, affiliation, affiliation_detail, email, password_hash, created_at
    FROM members
  `);

  // 移行されたレコード数を確認
  const count = db.prepare('SELECT COUNT(*) as count FROM members_new').get();
  console.log(`   ${count.count} レコードを移行しました`);

  // 3. 古いテーブルを削除
  console.log('3. 古いテーブルを削除...');
  db.exec('DROP TABLE members');

  // 4. 新しいテーブルをリネーム
  console.log('4. 新しいテーブルをリネーム...');
  db.exec('ALTER TABLE members_new RENAME TO members');

  // 5. インデックスを再作成
  console.log('5. インデックスを再作成...');
  db.exec('CREATE INDEX IF NOT EXISTS idx_member_id ON members(member_id)');

  // トランザクションをコミット
  db.exec('COMMIT');

  console.log('\n✅ マイグレーション完了!');
  console.log(`バックアップファイル: ${backupPath}`);
  console.log('\n変更内容:');
  console.log('  - qr_code カラムを削除');
  console.log('  - member_id カラムを追加（qr_code の値を使用）');
  console.log('  - member_id にユニーク制約とインデックスを設定');
  
} catch (error) {
  // エラーが発生した場合はロールバック
  console.error('\n❌ エラーが発生しました:', error.message);
  db.exec('ROLLBACK');
  console.log('変更をロールバックしました');
  process.exit(1);
} finally {
  db.close();
}
