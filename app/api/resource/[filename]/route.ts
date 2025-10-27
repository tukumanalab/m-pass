import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    try {
        const filename = params.filename;

        // セキュリティ: ディレクトリトラバーサル攻撃を防ぐ
        if (filename.includes("..") || filename.includes("/")) {
            return NextResponse.json(
                { error: "Invalid filename" },
                { status: 400 }
            );
        }

        // 許可されたファイル名のリスト
        const allowedFiles = [
            "logo.svg",
            "favicon.png",
            "hero.png",
            "icon-fabpass.svg",
            "card-template-default.svg",
            "success.wav",
            "error.wav",
        ];

        if (!allowedFiles.includes(filename)) {
            return NextResponse.json(
                { error: "File not found" },
                { status: 404 }
            );
        }

        const filePath = path.join(process.cwd(), "lib/resource", filename);

        // ファイルの存在確認
        if (!fs.existsSync(filePath)) {
            return NextResponse.json(
                { error: "File not found" },
                { status: 404 }
            );
        }

        // ファイルを読み込む
        const fileBuffer = fs.readFileSync(filePath);

        // Content-Typeを設定
        const ext = path.extname(filename).toLowerCase();
        const contentTypeMap: { [key: string]: string } = {
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".wav": "audio/wav",
            ".mp3": "audio/mpeg",
            ".ogg": "audio/ogg",
        };

        const contentType = contentTypeMap[ext] || "application/octet-stream";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("Resource fetch error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
