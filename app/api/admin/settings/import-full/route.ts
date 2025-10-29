import { NextRequest, NextResponse } from 'next/server';
import { saveSettings, SiteSettings } from '@/lib/settings';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'ファイルが選択されていません' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.json')) {
      return NextResponse.json(
        { success: false, message: 'JSONファイルを選択してください' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const data = JSON.parse(text);

    // 基本設定を抽出
    const settings: SiteSettings = {
      siteName: data.siteName,
      pageTitle: data.pageTitle,
      pageSubtitle: data.pageSubtitle,
      logoPath: data.logoPath || '',
      faviconPath: data.faviconPath || '',
      heroImagePath: data.heroImagePath || '',
    };

    // バリデーション
    if (!settings.siteName || !settings.pageTitle) {
      return NextResponse.json(
        { success: false, message: '不正な設定ファイルです' },
        { status: 400 }
      );
    }

    // uploadsディレクトリ作成
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // soundsディレクトリ作成
    const soundsDir = path.join(process.cwd(), 'public', 'sounds');
    if (!fs.existsSync(soundsDir)) {
      await mkdir(soundsDir, { recursive: true });
    }

    // 画像データを復元
    const imageKeys = [
      { key: 'logoPath', dataKey: 'logoPathData' },
      { key: 'faviconPath', dataKey: 'faviconPathData' },
      { key: 'heroImagePath', dataKey: 'heroImagePathData' },
    ];

    for (const { key, dataKey } of imageKeys) {
      if (data[dataKey]) {
        try {
          // Base64データからファイルを復元
          const matches = data[dataKey].match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // ファイル拡張子を取得
            const ext = getExtFromMimeType(mimeType);
            const filename = `${key.replace('Path', '')}-${Date.now()}${ext}`;
            const filepath = path.join(uploadsDir, filename);

            await writeFile(filepath, buffer);

            // BASE_PATHを使用してパスを生成
            const basePath = process.env.BASE_PATH || '';
            settings[key as keyof SiteSettings] = `${basePath}/uploads/${filename}` as any;
          }
        } catch (error) {
          console.error(`Failed to restore image ${dataKey}:`, error);
        }
      }
    }

    // 音声データを復元
    const soundTypes = ['success', 'error'];
    for (const type of soundTypes) {
      const dataKey = `${type}SoundData`;
      const extKey = `${type}SoundExt`;

      if (data[dataKey] && data[extKey]) {
        try {
          // Base64データからファイルを復元
          const matches = data[dataKey].match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // ファイル名を生成
            const ext = data[extKey];
            const filename = `${type}-sound.${ext}`;
            const filepath = path.join(soundsDir, filename);

            await writeFile(filepath, buffer);
          }
        } catch (error) {
          console.error(`Failed to restore sound ${dataKey}:`, error);
        }
      }
    }

    saveSettings(settings);

    return NextResponse.json({
      success: true,
      message: '設定をインポートしました',
      settings,
    });
  } catch (error) {
    console.error('Import settings error:', error);
    return NextResponse.json(
      { success: false, message: '設定のインポートに失敗しました' },
      { status: 500 }
    );
  }
}

function getExtFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/svg+xml': '.svg',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/x-icon': '.ico',
  };
  return extensions[mimeType] || '.png';
}
