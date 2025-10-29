import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// 画像ファイルの削除
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const ext = searchParams.get('ext');

        if (!type || !ext) {
            return NextResponse.json({ success: false, message: '無効なパラメータです' }, { status: 400 });
        }

        if (!['logo', 'favicon', 'hero'].includes(type)) {
            return NextResponse.json({ success: false, message: '無効なタイプです' }, { status: 400 });
        }

        const filename = `${type}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);

        if (existsSync(filepath)) {
            await unlink(filepath);
            return NextResponse.json({ success: true });
        }

        // ファイルが存在しない場合も成功とする
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Image delete error:', error);
        return NextResponse.json({ success: false, message: '削除に失敗しました' }, { status: 500 });
    }
}
