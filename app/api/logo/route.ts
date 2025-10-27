import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { loadSettings } from '@/lib/settings';

const DEFAULT_LOGO_PATH = path.join(process.cwd(), 'lib', 'resource', 'logo-default.svg');

export async function GET(request: NextRequest) {
  try {
    // 設定ファイルからロゴパスを取得
    const settings = loadSettings();
    let logoPath = DEFAULT_LOGO_PATH;
    let contentType = 'image/svg+xml';

    // カスタムロゴが設定されている場合
    if (settings.logoPath && settings.logoPath.includes('/uploads/')) {
      // /uploads/ 以降のパスを取得
      const uploadIndex = settings.logoPath.indexOf('/uploads/');
      const relativePath = settings.logoPath.substring(uploadIndex + 1); // 'uploads/filename' を取得
      const customLogoPath = path.join(process.cwd(), 'public', relativePath);

      if (fs.existsSync(customLogoPath)) {
        logoPath = customLogoPath;

        // Content-Typeを拡張子から判定
        const ext = path.extname(customLogoPath).toLowerCase();
        if (ext === '.png') {
          contentType = 'image/png';
        } else if (ext === '.jpg' || ext === '.jpeg') {
          contentType = 'image/jpeg';
        } else if (ext === '.svg') {
          contentType = 'image/svg+xml';
        }
      }
    }

    // ファイルを読み込む
    const logoContent = fs.readFileSync(logoPath, contentType === 'image/svg+xml' ? 'utf-8' : null);

    return new NextResponse(logoContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Failed to load logo:', error);
    return NextResponse.json({ error: 'Failed to load logo' }, { status: 500 });
  }
}
