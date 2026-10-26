#!/usr/bin/env node
/**
 * PM2起動用のwrapperスクリプト
 * .envファイルを明示的に読み込んでから Next.js を起動する
 */

const path = require('path');
const { spawn } = require('child_process');

// .envファイルを読み込む
const envPath = path.join(__dirname, '.env');
console.log('Loading .env from:', envPath);

const result = require('dotenv').config({ path: envPath });

if (result.error) {
  console.error('Failed to load .env file:', result.error);
  process.exit(1);
}

// 読み込んだ環境変数の数を表示
const envKeys = Object.keys(result.parsed || {});
console.log(`Loaded ${envKeys.length} environment variables from .env`);

// メール送信（Resend）の環境変数が読み込まれたか確認
const mailKeys = envKeys.filter(k => k === 'RESEND_API_KEY' || k === 'MAIL_FROM');
if (mailKeys.length > 0) {
  console.log('Resend mail variables loaded:', mailKeys.join(', '));
} else {
  console.warn('Warning: RESEND_API_KEY / MAIL_FROM not found in .env');
}

// Next.js を起動
const nextBin = path.join(__dirname, 'node_modules', '.bin', 'next');
console.log('Starting Next.js...');

// Next.js内部のdotenv再読み込みを防ぐため、環境変数を明示的に設定
const env = {
  ...process.env,
  ...result.parsed,
  // Next.jsのdotenv機能を無効化（環境変数は既に読み込み済み）
  SKIP_ENV_VALIDATION: 'true',
};

const child = spawn(nextBin, ['start'], {
  stdio: 'inherit',
  env: env,
});

child.on('error', (error) => {
  console.error('Failed to start Next.js:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
