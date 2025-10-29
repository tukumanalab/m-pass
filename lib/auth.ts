import { cookies } from 'next/headers';

/**
 * 管理者認証チェック
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');

  // トークンが存在するかチェック（簡易実装）
  return !!token?.value;
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
