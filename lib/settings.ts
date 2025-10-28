import fs from 'fs';
import path from 'path';

export interface SiteSettings {
  siteName: string;
  pageTitle: string;
  pageSubtitle: string;
  logoPath: string;
  faviconPath: string;
  heroImagePath: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'M-Pass',
  pageTitle: 'Member Pass System',
  pageSubtitle: 'メンバー情報システム',
  logoPath: '/api/resource/logo.png',
  faviconPath: '/api/resource/favicon.png',
  heroImagePath: '/api/resource/hero.png',
};

const SETTINGS_FILE = path.join(process.cwd(), 'site-settings.json');

/**
 * アップロードされたファイルを検索
 */
function findUploadedFile(type: string, extensions: string[]): string | null {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const basePath = process.env.BASE_PATH || '';

  if (!fs.existsSync(uploadsDir)) {
    return null;
  }

  for (const ext of extensions) {
    const filename = `${type}.${ext}`;
    const filepath = path.join(uploadsDir, filename);
    if (fs.existsSync(filepath)) {
      // ファイルの更新日時をキャッシュバスターとして使用
      const stats = fs.statSync(filepath);
      const timestamp = stats.mtimeMs;
      return `${basePath}/uploads/${filename}?v=${timestamp}`;
    }
  }

  return null;
}

/**
 * 設定ファイルを読み込む
 */
export function loadSettings(): SiteSettings {
  try {
    const basePath = process.env.BASE_PATH || '';

    let settings = { ...DEFAULT_SETTINGS };

    // デフォルト画像パスにBASE_PATHを適用
    settings.logoPath = `${basePath}/api/resource/logo.png`;
    settings.faviconPath = `${basePath}/api/resource/favicon.png`;
    settings.heroImagePath = `${basePath}/api/resource/hero.png`;

    // 設定ファイルから基本情報を読み込み
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const fileSettings = JSON.parse(data);

      // 基本情報のみをマージ（画像パスは除外）
      settings.siteName = fileSettings.siteName || settings.siteName;
      settings.pageTitle = fileSettings.pageTitle || settings.pageTitle;
      settings.pageSubtitle = fileSettings.pageSubtitle || settings.pageSubtitle;
    }

    // 画像パスをファイルシステムから自動検索（カスタム画像が優先）
    const uploadedLogo = findUploadedFile('logo', ['svg', 'png', 'jpeg', 'jpg']);
    if (uploadedLogo) settings.logoPath = uploadedLogo;

    const uploadedFavicon = findUploadedFile('favicon', ['png', 'ico', 'svg']);
    if (uploadedFavicon) settings.faviconPath = uploadedFavicon;

    const uploadedHero = findUploadedFile('hero', ['png', 'jpeg', 'jpg', 'webp']);
    if (uploadedHero) settings.heroImagePath = uploadedHero;

    return settings;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * 設定ファイルを保存
 */
export function saveSettings(settings: SiteSettings): void {
  try {
    // 画像パスは保存しない（基本情報のみ）
    const settingsToSave = {
      siteName: settings.siteName,
      pageTitle: settings.pageTitle,
      pageSubtitle: settings.pageSubtitle,
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

/**
 * 設定をリセット
 */
export function resetSettings(): SiteSettings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
