import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

// ログ出力用のヘルパー関数
function logToConsole(message: string, isError: boolean = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${message}`;
  
  if (isError) {
    console.error(logMessage);
    process.stderr.write(`${logMessage}\n`);
  } else {
    console.log(logMessage);
    process.stdout.write(`${logMessage}\n`);
  }
  
  // 強制的にフラッシュ
  if (process.stdout.isTTY) {
    process.stdout.write('');
  }
}

// 環境変数から管理者パスワードを取得（本番環境では必ず設定）
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$eHFkKLHLdUjcLwds5foX..qQ15MU5LY.by7CSpJLIo76BYy4UeK4K'; // デフォルト: "admin123"

/**
 * IPアドレスがプライベートネットワーク範囲内かチェック
 */
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fe80:/,
  ];
  return privateRanges.some(range => range.test(ip));
}

/**
 * IPアドレスが許可されたネットワーク範囲内かチェック
 */
function isAllowedIP(ip: string): boolean {
  const allowedIPs = process.env.ADMIN_ALLOWED_IPS;
  
  if (!allowedIPs) {
    return isPrivateIP(ip);
  }

  const allowedList = allowedIPs.split(',').map(s => s.trim());
  
  for (const allowed of allowedList) {
    if (allowed === '*') return true;
    if (allowed === 'private' && isPrivateIP(ip)) return true;
    if (ip === allowed) return true;
  }
  
  return false;
}

/**
 * リクエストからクライアントIPアドレスを取得
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return '127.0.0.1';
}

export async function POST(request: NextRequest) {
  logToConsole(`[ADMIN LOGIN] ===== Login Attempt Started =====`);
  
  try {
    // IP制限チェック
    const clientIP = getClientIP(request);
    const allowedIPs = process.env.ADMIN_ALLOWED_IPS || 'private';
    
    // 標準出力と標準エラー出力の両方に出力
    logToConsole(`[ADMIN LOGIN] Attempt from IP: ${clientIP} (Allowed: ${allowedIPs})`);
    
    if (!isAllowedIP(clientIP)) {
      logToConsole(`[ADMIN LOGIN] ⚠️  LOGIN DENIED from unauthorized IP: ${clientIP}`, true);
      return NextResponse.json(
        { success: false, message: 'このネットワークからの管理者アクセスは許可されていません' },
        { status: 403 }
      );
    }

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { success: false, message: 'パスワードを入力してください' },
        { status: 400 }
      );
    }

    // パスワード検証
    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

    if (isValid) {
      // セッショントークン生成（簡易実装）
      const token = Buffer.from(`admin:${Date.now()}`).toString('base64');

      const response = NextResponse.json({ success: true, message: 'ログイン成功' });

      // HTTPOnlyクッキーにトークンを設定（24時間有効）
      response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24時間
        path: '/',
      });

      logToConsole(`[ADMIN LOGIN] ✓ LOGIN SUCCESS from IP: ${clientIP}`);
      logToConsole(`[ADMIN LOGIN] ===== Login Attempt Completed =====`);
      
      return response;
    } else {
      logToConsole(`[ADMIN LOGIN] ✗ Invalid password from IP: ${clientIP}`, true);
      return NextResponse.json(
        { success: false, message: 'パスワードが正しくありません' },
        { status: 401 }
      );
    }
  } catch (error) {
    logToConsole(`[ADMIN LOGIN] ✗ Login error: ${error}`, true);
    return NextResponse.json(
      { success: false, message: '認証エラーが発生しました' },
      { status: 500 }
    );
  }
}
