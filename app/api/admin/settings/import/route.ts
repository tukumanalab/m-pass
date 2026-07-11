import { NextRequest, NextResponse } from 'next/server';
import { saveSettings, SiteSettings } from '@/lib/settings';
import fs from 'fs';
import path from 'path';

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

      // uploadsディレクトリを準備
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
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

      // ファイルをBase64からデコードして保存
      for (const fileData of exportData.files) {
        const buffer = Buffer.from(fileData.data, 'base64');
        const filePath = path.join(uploadsDir, fileData.name);
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
