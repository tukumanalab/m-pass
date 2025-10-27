import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET() {
  const isAuthenticated = await isAdminAuthenticated();
  return NextResponse.json({ authenticated: isAuthenticated });
}
