import { NextResponse } from 'next/server';
import { isAdminAuthenticated, refreshAdminTokenIfNeeded } from '@/lib/auth';

export async function GET() {
  const isAuthenticated = await isAdminAuthenticated();
  const response = NextResponse.json({ authenticated: isAuthenticated });
  if (isAuthenticated) {
    // 画面を開いている間はセッションを延長する
    await refreshAdminTokenIfNeeded(response);
  }
  return response;
}
