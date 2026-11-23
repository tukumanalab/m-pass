import { NextRequest, NextResponse } from 'next/server';
import { saveSettings, SiteSettings } from '@/lib/settings';
import fs from 'fs';
import path from 'path';
import { checkAdminAuth } from '@/lib/auth';

type ExportData = {
  version: string;
  exportDate: string;
  settings: {
    siteName: string;
    pageTitle: string;
    pageSubtitle: string;
    checkInIntervalMinutes?: number;
    successDisplaySeconds?: number;
    checkOutIntervalMinutes?: number;
  };
  files: Array<{ name: string; data: string; type: string }>;
};

export async function POST(request: NextRequest) {
  // 管理者認証チェック
  const unauthorized = await checkAdminAuth();
  if (unauthorized) return unauthorized;

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

    // エクスポートデータ形式かどうかをチェック
    if (data.version && data.settings && data.files) {
      // 新形式: エクスポートデータ
      const exportData = data as ExportData;

      // バリデーション
      if (!exportData.settings.siteName || !exportData.settings.pageTitle) {
        return NextResponse.json(
          { success: false, message: '不正な設定ファイルです' },
          { status: 400 }
        );
      }

      // 検証: ファイル名とサイズのチェック（パストラバーサル防止）
      const ALLOWED_FILENAME_REGEX = /^(logo|favicon|hero|success|error|card-template-custom)\.(svg|png|jpe?g|ico|webp|mp3|wav|ogg)$/;
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');

      if (!Array.isArray(exportData.files)) {
        return NextResponse.json(
          { success: false, message: '不正な設定ファイルです' },
          { status: 400 }
        );
      }

      const validatedFiles: Array<{ filePath: string; buffer: Buffer }> = [];
      for (const fileData of exportData.files) {
        if (
          !fileData ||
          typeof fileData.name !== 'string' ||
          typeof fileData.data !== 'string' ||
          path.basename(fileData.name) !== fileData.name ||
          !ALLOWED_FILENAME_REGEX.test(fileData.name)
        ) {
          return NextResponse.json(
            { success: false, message: '許可されていないファイル名が含まれています' },
            { status: 400 }
          );
        }
        const filePath = path.resolve(uploadsDir, fileData.name);
        if (!filePath.startsWith(uploadsDir + path.sep)) {
          return NextResponse.json(
            { success: false, message: '不正なファイルパスが含まれています' },
            { status: 400 }
          );
        }
        const buffer = Buffer.from(fileData.data, 'base64');
        if (buffer.length > MAX_FILE_SIZE) {
          return NextResponse.json(
            { success: false, message: 'ファイルサイズが上限（5MB）を超えています' },
            { status: 400 }
          );
        }
        validatedFiles.push({ filePath, buffer });
      }

      // uploadsディレクトリを準備
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // 既存のファイルを削除
      const existingFiles = fs.readdirSync(uploadsDir);
      for (const existingFile of existingFiles) {
        const filePath = path.join(uploadsDir, existingFile);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }

      // 検証済みファイルを保存
      for (const { filePath, buffer } of validatedFiles) {
        fs.writeFileSync(filePath, buffer);
      }

      // 設定を保存（基本情報のみ、画像パスは自動検索される）
      const settingsToSave: SiteSettings = {
        siteName: exportData.settings.siteName,
        pageTitle: exportData.settings.pageTitle,
        pageSubtitle: exportData.settings.pageSubtitle,
        logoPath: '', // ダミー値（saveSettingsで無視される）
        faviconPath: '', // ダミー値（saveSettingsで無視される）
        heroImagePath: '', // ダミー値（saveSettingsで無視される）
        checkInIntervalMinutes: typeof exportData.settings.checkInIntervalMinutes === 'number'
          ? exportData.settings.checkInIntervalMinutes
          : 10,
        successDisplaySeconds: typeof exportData.settings.successDisplaySeconds === 'number'
          ? exportData.settings.successDisplaySeconds
          : 10,
        checkOutIntervalMinutes: typeof exportData.settings.checkOutIntervalMinutes === 'number'
          ? exportData.settings.checkOutIntervalMinutes
          : 10,
      };
      saveSettings(settingsToSave);

      return NextResponse.json({
        success: true,
        message: `設定とファイル（${exportData.files.length}件）をインポートしました`,
        settings: exportData.settings,
      });
    } else {
      // 旧形式: 設定のみ
      const settings = data as SiteSettings;

      // バリデーション
      if (!settings.siteName || !settings.pageTitle) {
        return NextResponse.json(
          { success: false, message: '不正な設定ファイルです' },
          { status: 400 }
        );
      }

      saveSettings(settings);

      return NextResponse.json({
        success: true,
        message: '設定をインポートしました',
        settings,
      });
    }
  } catch (error) {
    console.error('Import settings error:', error);
    return NextResponse.json(
      { success: false, message: '設定のインポートに失敗しました' },
      { status: 500 }
    );
  }
}
