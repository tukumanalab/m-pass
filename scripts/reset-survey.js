#!/usr/bin/env node
// survey_responses テーブルのデータをリセットするスクリプト
//
// 使い方:
//   全件削除:
//     node scripts/reset-survey.js [--yes]
//   member_id（4桁ID）を指定して削除:
//     node scripts/reset-survey.js --member-id 6a1b [--yes]
//   survey_responses.id（連番）を指定して削除:
//     node scripts/reset-survey.js --id 3 [--yes]
//   DBパスを指定する場合:
//     DB_PATH=/app/data/members.db node scripts/reset-survey.js

const path = require('path');
const readline = require('readline');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'members.db');

// DBファイルの存在確認
if (!fs.existsSync(dbPath)) {
  console.error(`エラー: DBファイルが見つかりません: ${dbPath}`);
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);

// 引数パース
const args = process.argv.slice(2);
const skipConfirm = args.includes('--yes');

const memberIdIdx = args.indexOf('--member-id');
const idIdx = args.indexOf('--id');
const memberId = memberIdIdx !== -1 ? args[memberIdIdx + 1] : null;
const surveyId = idIdx !== -1 ? args[idIdx + 1] : null;

if (memberId && surveyId) {
  console.error('エラー: --member-id と --id は同時に指定できません。');
  process.exit(1);
}

console.log(`対象DBファイル: ${dbPath}`);

// 削除対象を絞り込んで表示
let targets;
if (memberId) {
  targets = db.prepare('SELECT * FROM survey_responses WHERE member_id = ?').all(memberId);
  console.log(`member_id = "${memberId}" の件数: ${targets.length} 件`);
} else if (surveyId) {
  targets = db.prepare('SELECT * FROM survey_responses WHERE id = ?').all(surveyId);
  console.log(`id = ${surveyId} の件数: ${targets.length} 件`);
} else {
  const count = db.prepare('SELECT COUNT(*) as count FROM survey_responses').get().count;
  targets = { length: count };
  console.log(`survey_responses の全件数: ${count} 件`);
}

if (targets.length === 0) {
  console.log('削除するデータはありません。');
  db.close();
  process.exit(0);
}

// 対象データをプレビュー表示（個別指定の場合）
if ((memberId || surveyId) && Array.isArray(targets)) {
  for (const row of targets) {
    console.log(`  id=${row.id}  member_id=${row.member_id}  affiliation=${row.affiliation}  how_did_you_know=${row.how_did_you_know}  created_at=${row.created_at}`);
  }
}

if (skipConfirm) {
  run();
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`${targets.length} 件のアンケートデータを削除しますか？ (yes/no): `, (answer) => {
    rl.close();
    if (answer === 'yes') {
      run();
    } else {
      console.log('キャンセルしました。');
      db.close();
    }
  });
}

function run() {
  let result;
  if (memberId) {
    result = db.prepare('DELETE FROM survey_responses WHERE member_id = ?').run(memberId);
  } else if (surveyId) {
    result = db.prepare('DELETE FROM survey_responses WHERE id = ?').run(surveyId);
  } else {
    result = db.prepare('DELETE FROM survey_responses').run();
  }
  console.log(`削除完了: ${result.changes} 件削除しました。`);
  db.close();
}
