#!/usr/bin/env node
// 環境変数の読み込みテスト
const path = require('path');
const fs = require('fs');

console.log('=== Environment Check ===');
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Node version:', process.version);

// .envファイルの存在確認
const envPath = path.join(process.cwd(), '.env');
console.log('\n.env file path:', envPath);
console.log('.env exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  console.log('.env lines count:', lines.length);
  console.log('\nMail (Resend) variables in .env:');
  lines.filter(line => line.startsWith('RESEND_') || line.startsWith('MAIL_')).forEach(line => {
    const [key] = line.split('=');
    console.log(`  - ${key.trim()}`);
  });
}

// dotenvで読み込み
console.log('\n=== Loading with dotenv ===');
const result = require('dotenv').config();
if (result.error) {
  console.error('dotenv error:', result.error);
} else {
  console.log('dotenv parsed keys:', Object.keys(result.parsed || {}).length);
  const mailKeys = Object.keys(result.parsed || {}).filter(k => k.startsWith('RESEND_') || k.startsWith('MAIL_'));
  console.log('Mail keys:', mailKeys);
}

// 環境変数の確認
console.log('\n=== Current Environment Variables ===');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET' : 'NOT SET');
console.log('MAIL_FROM:', process.env.MAIL_FROM ? 'SET' : 'NOT SET');
