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
  console.log('\nGMAIL variables in .env:');
  lines.filter(line => line.includes('GMAIL')).forEach(line => {
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
  const gmailKeys = Object.keys(result.parsed || {}).filter(k => k.includes('GMAIL'));
  console.log('GMAIL keys:', gmailKeys);
}

// 環境変数の確認
console.log('\n=== Current Environment Variables ===');
console.log('GMAIL_USER:', process.env.GMAIL_USER ? 'SET' : 'NOT SET');
console.log('GMAIL_CLIENT_ID:', process.env.GMAIL_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('GMAIL_CLIENT_SECRET:', process.env.GMAIL_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('GMAIL_REFRESH_TOKEN:', process.env.GMAIL_REFRESH_TOKEN ? 'SET' : 'NOT SET');
