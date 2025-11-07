import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // HTMLテンプレートを読み込み
    const htmlPath = path.join(process.cwd(), 'public', 'privacy-policy-template.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 環境変数で置換
    const appName = process.env.APP_NAME || 'つくまなラボメンバーズサイト（LabMem）';
    const contactEmail = process.env.CONTACT_EMAIL || '[お問い合わせ用メールアドレス]';
    const appHomeUrl = process.env.APP_HOME_URL || process.env.APP_URL || 'http://localhost:3000';

    htmlContent = htmlContent
      .replace(/\[アプリ名\]/g, appName)
      .replace(/\[お問い合わせ用メールアドレス\]/g, contactEmail)
      .replace(/\[アプリのホームページURL\]/g, appHomeUrl);

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
      },
    });
  } catch (error) {
    console.error('Error generating privacy policy HTML:', error);
    return new NextResponse('Privacy Policy not found', { status: 404 });
  }
}