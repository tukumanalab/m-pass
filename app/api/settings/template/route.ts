import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// GETリクエスト: 現在のカードテンプレートを取得
export async function GET() {
  try {
    // カスタムテンプレートのパス
    const customTemplatePath = path.join(process.cwd(), 'public/uploads/card-template-custom.svg');

    // カスタムテンプレートが存在するかチェック
    try {
      const customTemplate = await fs.readFile(customTemplatePath, 'utf-8');
      return NextResponse.json({
        template: customTemplate,
        isCustom: true,
      });
    } catch (error) {
      // カスタムテンプレートがない場合はデフォルトを返す
      const defaultTemplatePath = path.join(process.cwd(), 'lib/resource/card-template-default.svg');
      const defaultTemplate = await fs.readFile(defaultTemplatePath, 'utf-8');

      return NextResponse.json({
        template: defaultTemplate,
        isCustom: false,
      });
    }
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json(
      { error: 'テンプレートの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POSTリクエスト: カードテンプレートをアップロード
export async function POST(request: NextRequest) {
  try {
    const { template } = await request.json();

    if (!template || typeof template !== 'string') {
      return NextResponse.json(
        { error: 'テンプレートが無効です' },
        { status: 400 }
      );
    }

    // SVGファイルの検証（基本的なチェック）
    if (!template.trim().startsWith('<?xml') && !template.trim().startsWith('<svg')) {
      return NextResponse.json(
        { error: 'SVGフォーマットが無効です' },
        { status: 400 }
      );
    }

    // NAMEとXXXXのプレースホルダーが含まれているかチェック
    if (!template.includes('NAME') || !template.includes('XXXX')) {
      return NextResponse.json(
        { error: 'テンプレートには "NAME" と "XXXX" のプレースホルダーが必要です' },
        { status: 400 }
      );
    }

    // カスタムテンプレートをファイルに保存
    const uploadsDir = path.join(process.cwd(), 'public/uploads');
    // uploadsディレクトリが存在しない場合は作成
    await fs.mkdir(uploadsDir, { recursive: true });

    const customTemplatePath = path.join(uploadsDir, 'card-template-custom.svg');
    await fs.writeFile(customTemplatePath, template, 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'テンプレートを保存しました',
    });
  } catch (error) {
    console.error('Failed to save template:', error);
    return NextResponse.json(
      { error: 'テンプレートの保存に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETEリクエスト: カスタムテンプレートを削除してデフォルトに戻す
export async function DELETE() {
  try {
    const customTemplatePath = path.join(process.cwd(), 'public/uploads/card-template-custom.svg');

    // カスタムテンプレートファイルが存在する場合は削除
    try {
      await fs.unlink(customTemplatePath);
    } catch (error) {
      // ファイルが存在しない場合はエラーを無視
    }

    return NextResponse.json({
      success: true,
      message: 'デフォルトテンプレートに戻しました',
    });
  } catch (error) {
    console.error('Failed to reset template:', error);
    return NextResponse.json(
      { error: 'テンプレートのリセットに失敗しました' },
      { status: 500 }
    );
  }
}
