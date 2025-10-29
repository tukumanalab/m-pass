import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// 音声ファイルの存在確認（カスタム音声のみ）
export async function GET() {
  try {
    const extensions = ['mp3', 'wav', 'ogg'];

    // 成功音の確認（uploadsディレクトリにカスタムファイルがあるか）
    let hasSuccessSound = false;
    for (const ext of extensions) {
      const filepath = path.join(UPLOADS_DIR, `success.${ext}`);
      if (existsSync(filepath)) {
        hasSuccessSound = true;
        break;
      }
    }

    // エラー音の確認（uploadsディレクトリにカスタムファイルがあるか）
    let hasErrorSound = false;
    for (const ext of extensions) {
      const filepath = path.join(UPLOADS_DIR, `error.${ext}`);
      if (existsSync(filepath)) {
        hasErrorSound = true;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      hasSuccessSound,
      hasErrorSound,
    });
  } catch (error) {
    console.error('Audio status error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
