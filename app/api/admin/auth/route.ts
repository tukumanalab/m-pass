import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { headers } from 'next/headers';

// ログ出力用のヘルパー関数
function logToConsole(message: string, isError: boolean = false) {
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

// 環境変数から管理者パスワードを取得（本番環境では必ず設定）
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$eHFkKLHLdUjcLwds5foX..qQ15MU5LY.by7CSpJLIo76BYy4UeK4K'; // デフォルト: "admin123"

/**
 * IPアドレスがプライベートネットワーク範囲内かチェック
 */
function isPrivateIP(ip: string): boolean {
  // IPv6-mapped IPv4アドレスを標準的なIPv4形式に変換
  const normalizedIP = ip.replace(/^::ffff:/, '');
  
  // IPv4プライベートアドレス範囲
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // 127.0.0.0/8 (localhost)
    /^::1$/,                    // IPv6 localhost
    /^fe80:/,                   // IPv6 link-local
    /^::ffff:10\./,             // IPv6-mapped IPv4 private
    /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./, // IPv6-mapped IPv4 private
    /^::ffff:192\.168\./,       // IPv6-mapped IPv4 private
    /^::ffff:127\./,            // IPv6-mapped IPv4 localhost
  ];

  return privateRanges.some(range => range.test(ip)) || privateRanges.some(range => range.test(normalizedIP));
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
      // CIDR表記のチェック
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
 * リクエストからクライアントIPアドレスを取得
 */
async function getClientIP(): Promise<string> {
  const headersList = await headers();
  
  // プロキシ経由の場合を考慮
  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    // カンマ区切りの最初のIPを使用
    const ip = forwarded.split(',')[0].trim();
    logToConsole(`[IP DETECT] From X-Forwarded-For: ${ip}`);
    return ip;
  }
  
  const realIP = headersList.get('x-real-ip');
  if (realIP) {
    logToConsole(`[IP DETECT] From X-Real-IP: ${realIP}`);
    return realIP;
  }
  
  // フォールバック（開発環境用）
  logToConsole(`[IP DETECT] Using fallback: 127.0.0.1`);
  return '127.0.0.1';
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
