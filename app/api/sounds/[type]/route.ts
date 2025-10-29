import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ type: string }> }
) {
    try {
        const { type } = await params;

        // typeのバリデーション
        if (type !== 'success' && type !== 'error') {
            return new NextResponse('Invalid sound type', { status: 400 });
        }

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        const resourceDir = path.join(process.cwd(), 'lib', 'resource');

        // カスタム音声が存在するかチェック（wav, mp3, ogg）
        const formats = ['wav', 'mp3', 'ogg'];
        for (const format of formats) {
            const customPath = path.join(uploadsDir, `${type}.${format}`);
            if (fs.existsSync(customPath)) {
                const fileBuffer = fs.readFileSync(customPath);
                const mimeType = format === 'wav' ? 'audio/wav' : format === 'mp3' ? 'audio/mpeg' : 'audio/ogg';

                return new NextResponse(fileBuffer, {
                    headers: {
                        'Content-Type': mimeType,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                    },
                });
            }
        }

        // カスタム音声がない場合はデフォルト音声を返す
        const defaultPath = path.join(resourceDir, `${type}.wav`);

        if (!fs.existsSync(defaultPath)) {
            return new NextResponse('Sound file not found', { status: 404 });
        }

        const fileBuffer = fs.readFileSync(defaultPath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'audio/wav',
                'Cache-Control': 'public, max-age=86400', // デフォルト音声は24時間キャッシュ
            },
        });
    } catch (error) {
        console.error('Sound API error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
