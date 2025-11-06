#!/usr/bin/env node
/**
 * PM2起動用のwrapperスクリプト（デバッグ環境）
 * .envファイルを明示的に読み込んでから Next.js を起動する
 */

const path = require('path');
const { spawn } = require('child_process');

// .envファイルを読み込む
const envPath = path.join(__dirname, '.env');
console.log('[DEBUG] Loading .env from:', envPath);

const result = require('dotenv').config({ path: envPath });

if (result.error) {
  console.error('[DEBUG] Failed to load .env file:', result.error);
  process.exit(1);
}

// 読み込んだ環境変数の数を表示
const envKeys = Object.keys(result.parsed || {});
console.log(`[DEBUG] Loaded ${envKeys.length} environment variables from .env`);

// GMAILの環境変数が読み込まれたか確認
const gmailKeys = envKeys.filter(k => k.startsWith('GMAIL_'));
if (gmailKeys.length > 0) {
  console.log('[DEBUG] Gmail OAuth2 variables loaded:', gmailKeys.join(', '));
} else {
  console.warn('[DEBUG] Warning: No GMAIL_* variables found in .env');
}

// デバッグ環境用の環境変数を上書き
const debugEnv = {
  ...process.env,
  ...result.parsed,
  PORT: '3001',
  DB_PATH: './members-debug.db',
  BASE_PATH: '/members',
};

// Next.js を起動
const nextBin = path.join(__dirname, 'node_modules', '.bin', 'next');
console.log('[DEBUG] Starting Next.js...');

// Next.js内部のdotenv再読み込みを防ぐため、環境変数を明示的に設定
const finalEnv = {
  ...debugEnv,
  // Next.jsのdotenv機能を無効化（環境変数は既に読み込み済み）
  SKIP_ENV_VALIDATION: 'true',
};

const child = spawn(nextBin, ['start'], {
  stdio: 'inherit',
  env: finalEnv,
});

child.on('error', (error) => {
  console.error('[DEBUG] Failed to start Next.js:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
