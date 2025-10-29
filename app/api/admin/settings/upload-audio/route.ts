import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const AUDIO_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 音声ファイルのアップロード
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file || !type) {
      return NextResponse.json({ success: false, message: 'ファイルまたはタイプが指定されていません' }, { status: 400 });
    }

    if (!['success', 'error'].includes(type)) {
      return NextResponse.json({ success: false, message: '無効なタイプです' }, { status: 400 });
    }

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, message: 'ファイルサイズは5MB以下にしてください' }, { status: 400 });
    }

    // ファイル形式チェック
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'MP3, WAV, OGG形式のみ対応しています' }, { status: 400 });
    }

    // 拡張子を取得
    const ext = file.name.split('.').pop() || 'mp3';
    const filename = `${type}.${ext}`;
    const filepath = path.join(AUDIO_DIR, filename);

    // ディレクトリが存在しない場合は作成
    const { mkdir } = await import('fs/promises');
    await mkdir(AUDIO_DIR, { recursive: true });

    // 既存の同タイプのファイルを削除（拡張子が違う場合も削除）
    const extensions = ['mp3', 'wav', 'ogg'];
    for (const oldExt of extensions) {
      const oldFilename = `${type}.${oldExt}`;
      const oldFilepath = path.join(AUDIO_DIR, oldFilename);
      if (existsSync(oldFilepath) && oldFilepath !== filepath) {
        await unlink(oldFilepath);
      }
    }

    // ファイルを保存
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    return NextResponse.json({
      success: true,
      path: `/uploads/${filename}`,
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    return NextResponse.json({ success: false, message: 'アップロードに失敗しました' }, { status: 500 });
  }
}

// 音声ファイルの削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !['success', 'error'].includes(type)) {
      return NextResponse.json({ success: false, message: '無効なタイプです' }, { status: 400 });
    }

    // 既存のファイルを探して削除
    const extensions = ['mp3', 'wav', 'ogg'];
    for (const ext of extensions) {
      const filename = `${type}.${ext}`;
      const filepath = path.join(AUDIO_DIR, filename);

      if (existsSync(filepath)) {
        await unlink(filepath);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Audio delete error:', error);
    return NextResponse.json({ success: false, message: '削除に失敗しました' }, { status: 500 });
  }
}
