import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { logger } from './logger';

// 管理者トークンの署名鍵（ADMIN_JWT_SECRET 未設定時は管理者パスワードのハッシュを鍵として使う）
// どちらも未設定の本番環境では、既定値で署名しないようエラーにする
let adminTokenSecret: Uint8Array | null = null;
function getAdminTokenSecret(): Uint8Array {
  if (adminTokenSecret) return adminTokenSecret;
  const secret = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PASSWORD_HASH;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_JWT_SECRET または ADMIN_PASSWORD_HASH が設定されていません');
  }
  adminTokenSecret = new TextEncoder().encode(secret || 'dev-only-admin-secret');
  return adminTokenSecret;
}
export const ADMIN_TOKEN_MAX_AGE = 60 * 60 * 24; // 24時間
// 発行からこの秒数を過ぎた有効なトークンは、認証確認時に再発行して有効期限を延長する（スライディング方式）
export const ADMIN_TOKEN_REFRESH_AFTER = 60 * 60; // 1時間

/**
 * 管理者トークン（署名付きJWT）を生成
 */
export async function createAdminToken(): Promise<string> {
  return await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TOKEN_MAX_AGE}s`)
    .sign(getAdminTokenSecret());
}

/**
 * 管理者トークンの署名と有効期限を検証
 */
async function verifyAdminToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminTokenSecret());
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * 管理者トークンをHTTPOnlyクッキーに設定
 */
export function setAdminTokenCookie(response: NextResponse, token: string): void {
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_TOKEN_MAX_AGE,
    path: '/',
  });
}

/**
 * 現在の管理者トークンが有効で発行から一定時間を過ぎていれば再発行し、レスポンスのクッキーを更新する
 * （認証済みであることを呼び出し側で確認してから使う）
 */
export async function refreshAdminTokenIfNeeded(response: NextResponse): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return;

  const payload = await verifyAdminToken(token);
  if (!payload) return;

  const issuedAt = typeof payload.iat === 'number' ? payload.iat : 0;
  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  if (ageSeconds < ADMIN_TOKEN_REFRESH_AFTER) return;

  setAdminTokenCookie(response, await createAdminToken());
  logToConsole(`[ADMIN AUTH] Admin token refreshed (age: ${ageSeconds}s)`);
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
 * IPv6-mapped IPv4アドレス (::ffff:x.x.x.x) を標準のIPv4形式に正規化
 */
export function normalizeIP(ip: string): string {
  return ip.trim().replace(/^::ffff:/i, '');
}

/**
 * IPアドレスがプライベートネットワーク範囲内かチェック
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip || ip === 'unknown') return false;
  const normalizedIP = normalizeIP(ip);

  // IPv4/IPv6プライベートアドレス範囲
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // 127.0.0.0/8 (localhost)
    /^::1$/,                    // IPv6 localhost
    /^fe80:/i,                  // IPv6 link-local
  ];

  return privateRanges.some(range => range.test(normalizedIP));
}

/**
 * IPアドレスが許可されたネットワーク範囲内かチェック
 */
export function isAllowedIP(ip: string): boolean {
  if (!ip || ip === 'unknown') {
    logToConsole(`[IP CHECK] Unknown or missing client IP - DENIED`, true);
    return false;
  }

  const normalizedIP = normalizeIP(ip);
  // 環境変数から許可するIPアドレス範囲を取得
  const allowedIPs = process.env.ADMIN_ALLOWED_IPS;
  
  logToConsole(`[IP CHECK] Checking IP: ${normalizedIP}, Allowed config: ${allowedIPs || 'private (default)'}`);
  
  if (!allowedIPs) {
    // 設定がない場合はプライベートIPのみ許可
    const result = isPrivateIP(normalizedIP);
    logToConsole(`[IP CHECK] Using default (private only), Result: ${result}`);
    return result;
  }

  // カンマ区切りで複数のIPまたはCIDRを指定可能
  const allowedList = allowedIPs.split(',').map(s => s.trim()).filter(Boolean);
  
  for (const allowed of allowedList) {
    if (allowed === '*') {
      // ワイルドカードですべて許可
      logToConsole(`[IP CHECK] Wildcard match - ALLOWED`);
      return true;
    }
    
    if (allowed === 'private') {
      // プライベートIPを許可
      if (isPrivateIP(normalizedIP)) {
        logToConsole(`[IP CHECK] Private IP match - ALLOWED`);
        return true;
      }
    } else if (allowed.includes('/')) {
      // CIDR表記のチェック
      const [network, bits] = allowed.split('/');
      const maskBits = Number(bits);
      
      if (matchesCIDR(normalizedIP, network, maskBits)) {
        logToConsole(`[IP CHECK] CIDR match (${allowed}) - ALLOWED`);
        return true;
      }
    } else {
      // 完全一致
      if (normalizedIP === normalizeIP(allowed)) {
        logToConsole(`[IP CHECK] Exact match (${allowed}) - ALLOWED`);
        return true;
      }
    }
  }
  
  logToConsole(`[IP CHECK] No match found - DENIED`, true);
  return false;
}

/**
 * IPがCIDR範囲内かチェック
 */
function matchesCIDR(ip: string, network: string, maskBits: number): boolean {
  if (!Number.isInteger(maskBits) || maskBits < 0 || maskBits > 32) {
    return false;
  }

  const normalizedIP = normalizeIP(ip);
  const normalizedNet = normalizeIP(network);
  const ipParts = normalizedIP.split('.').map(Number);
  const netParts = normalizedNet.split('.').map(Number);
  
  if (
    ipParts.length !== 4 ||
    netParts.length !== 4 ||
    ipParts.some(p => !Number.isInteger(p) || p < 0 || p > 255) ||
    netParts.some(p => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return false;
  }
  
  // IPアドレスとネットワークアドレスを32ビット整数に変換
  const ipInt = ipParts.reduce((acc, part) => (acc << 8) + part, 0);
  const netInt = netParts.reduce((acc, part) => (acc << 8) + part, 0);

  // マスクを生成
  const mask = maskBits === 0 ? 0 : (-1 << (32 - maskBits));

  // マスクを適用して比較
  return (ipInt & mask) === (netInt & mask);
}

/**
 * リクエストからクライアントIPアドレスを取得
 */
export async function getClientIP(options: { log?: boolean } = {}): Promise<string> {
  const headersList = await headers();
  // 公開APIのレート制限からも呼ばれるため、ログ出力は呼び出し側で抑止できるようにする
  const log = (message: string) => { if (options.log !== false) logToConsole(message); };
  
  // nginx が接続元アドレスを設定する X-Real-IP を優先する
  // （X-Forwarded-For の先頭はクライアントが自由に書き換えられるため）
  const realIP = headersList.get('x-real-ip')?.trim();
  if (realIP) {
    log(`[IP DETECT] From X-Real-IP: ${realIP}`);
    return realIP;
  }

  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    // カンマ区切りの最後のIP（直近のプロキシが付加したもの）を使用
    const ips = forwarded.split(',').map(s => s.trim()).filter(Boolean);
    const ip = ips[ips.length - 1];
    if (ip) {
      log(`[IP DETECT] From X-Forwarded-For: ${ip}`);
      return ip;
    }
  }
  
  // 本番環境ではプロキシヘッダー欠落時に 127.0.0.1（プライベートIP許可）へフォールバックしない
  if (process.env.NODE_ENV === 'production') {
    log(`[IP DETECT] Missing proxy IP headers in production`);
    return 'unknown';
  }

  // フォールバック（開発環境用）
  log(`[IP DETECT] Using dev fallback: 127.0.0.1`);
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
