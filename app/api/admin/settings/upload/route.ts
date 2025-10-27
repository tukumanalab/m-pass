import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { loadSettings } from '@/lib/settings';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'ファイルが選択されていません' },
        { status: 400 }
      );
    }

    // ファイルタイプチェック
    const allowedTypes: Record<string, string[]> = {
      logo: ['image/svg+xml', 'image/png', 'image/jpeg'],
      favicon: ['image/x-icon', 'image/png', 'image/svg+xml'],
      hero: ['image/png', 'image/jpeg', 'image/webp'],
    };

    if (!type || !allowedTypes[type]) {
      return NextResponse.json(
        { success: false, message: '不正なファイルタイプです' },
        { status: 400 }
      );
    }

    if (!allowedTypes[type].includes(file.type)) {
      return NextResponse.json(
        { success: false, message: '許可されていないファイル形式です' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（5MB）
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'ファイルサイズは5MB以下にしてください' },
        { status: 400 }
      );
    }

    // uploadsディレクトリ作成（存在しない場合）
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 拡張子を取得
    const ext = file.name.split('.').pop();

    // 固定のファイル名を使用（拡張子のみ変更可能）
    const filename = `${type}.${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // 新しいファイル保存（既存ファイルを上書き）
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // ファイル名のみを返す（パスは含めない）
    const publicPath = filename;

    return NextResponse.json({
      success: true,
      path: publicPath,
      message: 'ファイルをアップロードしました',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, message: 'アップロードに失敗しました' },
      { status: 500 }
    );
  }
}
