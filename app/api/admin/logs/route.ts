import { NextRequest, NextResponse } from 'next/server';
import { getLogs, getLogsCount } from '@/lib/database';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // 管理者認証チェック
  const isAuthenticated = await isAdminAuthenticated();
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const level = searchParams.get('level') || undefined;

  const offset = (page - 1) * limit;

  try {
    const logs = getLogs(limit, offset, level);
    const totalCount = getLogsCount(level);
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
