import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// GitHub Actions から呼ばれるデプロイ用 Webhook
// ビルド済み成果物の取得・入れ替え・再起動は deploy/deploy.sh が行う
const SCRIPT_PATH = path.join(process.cwd(), 'deploy', 'deploy.sh');
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_PATH = path.join(LOG_DIR, 'deploy.log');

function isValidToken(token: string, secret: string): boolean {
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.DEPLOY_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Deploy not configured' }, { status: 503 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!isValidToken(token, secret)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sha?: unknown; runId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const sha = String(body.sha ?? '');
  const runId = String(body.runId ?? '');
  if (!/^[0-9a-f]{40}$/.test(sha) || !/^\d+$/.test(runId)) {
    return NextResponse.json({ success: false, error: 'Invalid sha or runId' }, { status: 400 });
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFd = fs.openSync(LOG_PATH, 'a');

  // setsid -f で親プロセスから切り離す
  // （pm2 restart はアプリの子プロセスごと終了させるため、デプロイ中に止められないようにする）
  const child = spawn('setsid', ['-f', 'bash', SCRIPT_PATH, sha, runId], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.on('error', (error) => {
    console.error('デプロイスクリプトの起動に失敗しました:', error);
  });
  child.unref();
  fs.closeSync(logFd);

  return NextResponse.json({ success: true, message: 'デプロイを開始しました' }, { status: 202 });
}
