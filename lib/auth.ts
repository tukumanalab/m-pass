import { cookies, headers } from 'next/headers';

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
  
  if (!allowedIPs) {
    // 設定がない場合はプライベートIPのみ許可
    return isPrivateIP(ip);
  }

  // カンマ区切りで複数のIPまたはCIDRを指定可能
  const allowedList = allowedIPs.split(',').map(s => s.trim());
  
  for (const allowed of allowedList) {
    if (allowed === '*') {
      // ワイルドカードですべて許可
      return true;
    }
    
    if (allowed === 'private') {
      // プライベートIPを許可
      if (isPrivateIP(ip)) return true;
    } else if (allowed.includes('/')) {
      // CIDR表記のチェック（簡易実装）
      const [network, bits] = allowed.split('/');
      const maskBits = parseInt(bits, 10);
      
      if (matchesCIDR(ip, network, maskBits)) {
        return true;
      }
    } else {
      // 完全一致
      if (ip === allowed) return true;
    }
  }
  
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
  
  // マスクビットを超えたビット数だけチェック
  let bitsToCheck = maskBits;
  for (let i = 0; i < 4 && bitsToCheck > 0; i++) {
    const bitsInOctet = Math.min(8, bitsToCheck);
    const mask = (0xFF << (8 - bitsInOctet)) & 0xFF;
    
    if ((ipParts[i] & mask) !== (netParts[i] & mask)) {
      return false;
    }
    
    bitsToCheck -= bitsInOctet;
  }
  
  return true;
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
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = headersList.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // フォールバック（開発環境用）
  return '127.0.0.1';
}

/**
 * 管理者認証チェック（IPチェック含む）
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');

  // トークンが存在するかチェック
  if (!token?.value) {
    return false;
  }

  // IP制限チェック
  const clientIP = await getClientIP();
  const allowedIPs = process.env.ADMIN_ALLOWED_IPS || 'private';
  
  // 標準出力と標準エラー出力の両方に出力
  const logMessage = `[ADMIN AUTH] Access attempt from IP: ${clientIP} (Allowed: ${allowedIPs})`;
  console.log(logMessage);
  process.stdout.write(`${logMessage}\n`);
  
  if (!isAllowedIP(clientIP)) {
    const denyMessage = `[ADMIN AUTH] ⚠️  Access DENIED from unauthorized IP: ${clientIP}`;
    console.error(denyMessage);
    process.stderr.write(`${denyMessage}\n`);
    return false;
  }

  const successMessage = `[ADMIN AUTH] ✓ Access ALLOWED from IP: ${clientIP}`;
  console.log(successMessage);
  process.stdout.write(`${successMessage}\n`);
  
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
