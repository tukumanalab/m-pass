import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { logger } from './logger';

// 管理者トークンの署名鍵（ADMIN_JWT_SECRET 未設定時は管理者パスワードのハッシュを鍵として使う）
const ADMIN_TOKEN_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PASSWORD_HASH || 'change-this-admin-secret-in-production'
);
export const ADMIN_TOKEN_MAX_AGE = 60 * 60 * 24; // 24時間

/**
 * 管理者トークン（署名付きJWT）を生成
 */
export async function createAdminToken(): Promise<string> {
  return await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TOKEN_MAX_AGE}s`)
    .sign(ADMIN_TOKEN_SECRET);
}

/**
 * 管理者トークンの署名と有効期限を検証
 */
async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, ADMIN_TOKEN_SECRET);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// ログ出力用のヘルパー関数
function logToConsole(message: string, isError: boolean = false) {
  if (isError) {
    logger.error(message);
  } else {
    logger.info(message);
  }
}

/**
 * IPアドレスがプライベートネットワーク範囲内かチェック
 */
function isPrivateIP(ip: string): boolean {
  // IPv4プライベートアドレス範囲
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // 127.0.0.0/8 (localhost)
    /^::1$/,                    // IPv6 localhost
    /^fe80:/,                   // IPv6 link-local
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * IPアドレスが許可されたネットワーク範囲内かチェック
 */
function isAllowedIP(ip: string): boolean {
  // 環境変数から許可するIPアドレス範囲を取得
  const allowedIPs = process.env.ADMIN_ALLOWED_IPS;
  
  logToConsole(`[IP CHECK] Checking IP: ${ip}, Allowed config: ${allowedIPs || 'private (default)'}`);
  
  if (!allowedIPs) {
    // 設定がない場合はプライベートIPのみ許可
    const result = isPrivateIP(ip);
    logToConsole(`[IP CHECK] Using default (private only), Result: ${result}`);
    return result;
  }

  // カンマ区切りで複数のIPまたはCIDRを指定可能
  const allowedList = allowedIPs.split(',').map(s => s.trim());
  
  for (const allowed of allowedList) {
    if (allowed === '*') {
      // ワイルドカードですべて許可
      logToConsole(`[IP CHECK] Wildcard match - ALLOWED`);
      return true;
    }
    
    if (allowed === 'private') {
      // プライベートIPを許可
      if (isPrivateIP(ip)) {
        logToConsole(`[IP CHECK] Private IP match - ALLOWED`);
        return true;
      }
    } else if (allowed.includes('/')) {
      // CIDR表記のチェック（簡易実装）
      const [network, bits] = allowed.split('/');
      const maskBits = parseInt(bits, 10);
      
      if (matchesCIDR(ip, network, maskBits)) {
        logToConsole(`[IP CHECK] CIDR match (${allowed}) - ALLOWED`);
        return true;
      }
    } else {
      // 完全一致
      if (ip === allowed) {
        logToConsole(`[IP CHECK] Exact match (${allowed}) - ALLOWED`);
        return true;
      }
    }
  }
  
  logToConsole(`[IP CHECK] No match found - DENIED`, true);
  return false;
}

/**
 * IPがCIDR範囲内かチェック（簡易実装）
 */
function matchesCIDR(ip: string, network: string, maskBits: number): boolean {
  const ipParts = ip.split('.').map(Number);
  const netParts = network.split('.').map(Number);
  
  if (ipParts.length !== 4 || netParts.length !== 4) {
    return false;
  }
  
  // IPアドレスとネットワークアドレスを32ビット整数に変換
  const ipInt = ipParts.reduce((acc, part) => (acc << 8) + part, 0);
  const netInt = netParts.reduce((acc, part) => (acc << 8) + part, 0);

  // マスクを生成
  // maskBitsが0の場合、-1 << 0 は -1 (0xFFFFFFFF) となるため、32ビットの範囲で安全にシフトする
  const mask = maskBits === 0 ? 0 : (-1 << (32 - maskBits));

  // マスクを適用して比較
  return (ipInt & mask) === (netInt & mask);
}

/**
 * リクエストからクライアントIPアドレスを取得
 */
async function getClientIP(): Promise<string> {
  const headersList = await headers();
  
  // nginx が接続元アドレスを設定する X-Real-IP を優先する
  // （X-Forwarded-For の先頭はクライアントが自由に書き換えられるため）
  const realIP = headersList.get('x-real-ip');
  if (realIP) {
    logToConsole(`[IP DETECT] From X-Real-IP: ${realIP}`);
    return realIP;
  }

  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    // カンマ区切りの最後のIP（直近のプロキシが付加したもの）を使用
    const ips = forwarded.split(',').map(s => s.trim()).filter(Boolean);
    const ip = ips[ips.length - 1];
    logToConsole(`[IP DETECT] From X-Forwarded-For: ${ip}`);
    return ip;
  }
  
  // フォールバック（開発環境用）
  logToConsole(`[IP DETECT] Using fallback: 127.0.0.1`);
  return '127.0.0.1';
}

/**
 * 管理者認証チェック（IPチェック含む）
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  logToConsole(`[ADMIN AUTH] ===== Authentication Check Started =====`);
  
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');

  // トークンが存在するかチェック
  if (!token?.value) {
    logToConsole(`[ADMIN AUTH] ✗ No admin token found`, true);
    return false;
  }

  if (!(await verifyAdminToken(token.value))) {
    logToConsole(`[ADMIN AUTH] ✗ Invalid or expired admin token`, true);
    return false;
  }

  logToConsole(`[ADMIN AUTH] ✓ Admin token verified`);

  // IP制限チェック
  const clientIP = await getClientIP();
  const allowedIPs = process.env.ADMIN_ALLOWED_IPS || 'private';
  
  logToConsole(`[ADMIN AUTH] Access attempt from IP: ${clientIP} (Allowed: ${allowedIPs})`);
  
  if (!isAllowedIP(clientIP)) {
    logToConsole(`[ADMIN AUTH] ⚠️  Access DENIED from unauthorized IP: ${clientIP}`, true);
    return false;
  }

  logToConsole(`[ADMIN AUTH] ✓ Access ALLOWED from IP: ${clientIP}`);
  logToConsole(`[ADMIN AUTH] ===== Authentication Check Completed =====`);
  
  return true;
}

/**
 * 管理者認証が必要なページで使用
 */
export async function requireAdminAuth() {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    throw new Error('Unauthorized');
  }

  return true;
}

/**
 * 管理者API用の認証チェック
 * 未認証なら401レスポンスを返し、認証済みならnullを返す
 */
export async function checkAdminAuth(): Promise<NextResponse | null> {
  if (await isAdminAuthenticated()) {
    return null;
  }
  return NextResponse.json(
    { success: false, error: '認証が必要です', message: '認証が必要です' },
    { status: 401 }
  );
}
