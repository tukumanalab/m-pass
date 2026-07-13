import { NextRequest, NextResponse } from 'next/server';
import { getAllAffiliations } from '@/lib/database';

// 登録されているすべての所属を取得
export async function GET(request: NextRequest) {
  try {
    const affiliations = getAllAffiliations();
    return NextResponse.json(affiliations);
  } catch (error) {
    console.error('Error fetching affiliations:', error);
    return NextResponse.json({ error: 'Failed to fetch affiliations' }, { status: 500 });
  }
}
