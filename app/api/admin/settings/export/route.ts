import { NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const settings = loadSettings();
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

    // 基本情報のみをエクスポート（画像パスは除外）
    const exportSettings = {
      siteName: settings.siteName,
      pageTitle: settings.pageTitle,
      pageSubtitle: settings.pageSubtitle,
    };

    // エクスポートデータを構築
    const exportData: {
      version: string;
      exportDate: string;
      settings: typeof exportSettings;
      files: Array<{ name: string; data: string; type: string }>;
    } = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      settings: exportSettings,
      files: [],
    };

    // uploadsディレクトリの全ファイルをBase64エンコード
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        if (fs.statSync(filePath).isFile()) {
          const fileData = fs.readFileSync(filePath);
          const base64Data = fileData.toString('base64');

          // ファイルタイプを拡張子から判定
          const ext = path.extname(file).toLowerCase();
          let mimeType = 'application/octet-stream';
          if (ext === '.png') mimeType = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
          else if (ext === '.svg') mimeType = 'image/svg+xml';
          else if (ext === '.ico') mimeType = 'image/x-icon';
          else if (ext === '.webp') mimeType = 'image/webp';
          else if (ext === '.wav') mimeType = 'audio/wav';
          else if (ext === '.mp3') mimeType = 'audio/mpeg';

          exportData.files.push({
            name: file,
            data: base64Data,
            type: mimeType,
          });
        }
      }
    }

    // JSON形式でダウンロード
    const fileName = `m-pass-settings-${new Date().toISOString().split('T')[0]}.json`;
    const jsonData = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Export settings error:', error);
    return NextResponse.json(
      { success: false, message: '設定のエクスポートに失敗しました' },
      { status: 500 }
    );
  }
}
