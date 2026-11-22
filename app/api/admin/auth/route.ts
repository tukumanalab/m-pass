import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { createAdminToken, ADMIN_TOKEN_MAX_AGE, isAllowedIP, getClientIP } from '@/lib/auth';
import { checkRateLimits, MINUTE } from '@/lib/rate-limit';

// ログ出力用のヘルパー関数
function logToConsole(message: string, isError: boolean = false) {
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

// 開発環境のみで使用するフォールバックハッシュ（本番環境では ADMIN_PASSWORD_HASH の設定を必須とする）
const DEV_FALLBACK_PASSWORD_HASH = '$2b$10$eHFkKLHLdUjcLwds5foX..qQ15MU5LY.by7CSpJLIo76BYy4UeK4K'; // "admin123"

function getAdminPasswordHash(): string | null {
  if (process.env.ADMIN_PASSWORD_HASH) {
    return process.env.ADMIN_PASSWORD_HASH;
  }
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return DEV_FALLBACK_PASSWORD_HASH;
}

export async function POST(request: NextRequest) {
  logToConsole(`[ADMIN LOGIN] ===== Login Attempt Started =====`);
  
  try {
    // IP制限チェック
    const clientIP = await getClientIP();
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

    // ブルートフォース対策のレート制限（同一IPから15分間に10回まで）
    const rateLimited = await checkRateLimits([
      { scope: 'admin-auth:ip', limit: 10, windowMs: 15 * MINUTE },
    ]);
    if (rateLimited) {
      logToConsole(`[ADMIN LOGIN] ⚠️  RATE LIMITED from IP: ${clientIP}`, true);
      return NextResponse.json(
        { success: false, message: 'ログイン試行回数が上限に達しました。しばらく時間をおいて再度お試しください。' },
        { status: 429 }
      );
    }

    const adminPasswordHash = getAdminPasswordHash();
    if (!adminPasswordHash) {
      logToConsole(`[ADMIN LOGIN] ✗ ADMIN_PASSWORD_HASH is not configured in production`, true);
      return NextResponse.json(
        { success: false, message: '管理者認証が設定されていません' },
        { status: 503 }
      );
    }

    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, message: 'パスワードを入力してください' },
        { status: 400 }
      );
    }

    // パスワード検証
    const isValid = await bcrypt.compare(password, adminPasswordHash);
    // const isValid = true; // TEMPORARY BYPASS FOR TESTING

    if (isValid) {
      // セッショントークン生成（署名付きJWT）
      const token = await createAdminToken();

      const response = NextResponse.json({ success: true, message: 'ログイン成功' });

      // HTTPOnlyクッキーにトークンを設定（24時間有効）
      response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: ADMIN_TOKEN_MAX_AGE, // 24時間
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
