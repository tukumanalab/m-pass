import { NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const settings = loadSettings();

    // 画像ファイルをBase64に変換
    const settingsWithImages: any = { ...settings };

    const imagePaths = [
      { key: 'logoPath', path: settings.logoPath },
      { key: 'faviconPath', path: settings.faviconPath },
      { key: 'heroImagePath', path: settings.heroImagePath },
    ];

    for (const { key, path: imagePath } of imagePaths) {
      if (imagePath) {
        try {
          const fullPath = path.join(process.cwd(), 'public', imagePath);
          if (fs.existsSync(fullPath)) {
            const imageBuffer = fs.readFileSync(fullPath);
            const base64 = imageBuffer.toString('base64');
            const ext = path.extname(imagePath);
            const mimeType = getMimeType(ext);
            settingsWithImages[`${key}Data`] = `data:${mimeType};base64,${base64}`;
          }
        } catch (error) {
          console.error(`Failed to read image ${imagePath}:`, error);
        }
      }
    }

    // 音声ファイルをBase64に変換
    const soundsDir = path.join(process.cwd(), 'public', 'sounds');
    const soundExtensions = ['mp3', 'wav', 'ogg'];
    const soundTypes = ['success', 'error'];

    for (const type of soundTypes) {
      for (const ext of soundExtensions) {
        const filename = `${type}-sound.${ext}`;
        const soundPath = path.join(soundsDir, filename);
        if (fs.existsSync(soundPath)) {
          try {
            const soundBuffer = fs.readFileSync(soundPath);
            const base64 = soundBuffer.toString('base64');
            const mimeType = getAudioMimeType(ext);
            settingsWithImages[`${type}SoundData`] = `data:${mimeType};base64,${base64}`;
            settingsWithImages[`${type}SoundExt`] = ext;
          } catch (error) {
            console.error(`Failed to read sound ${filename}:`, error);
          }
          break; // 見つかったら他の拡張子はチェックしない
        }
      }
    }

    // JSON形式でダウンロード
    return new NextResponse(JSON.stringify(settingsWithImages, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="site-settings-full-${Date.now()}.json"`,
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

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

function getAudioMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}
