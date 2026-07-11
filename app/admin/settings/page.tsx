"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface SiteSettings {
  siteName: string;
  pageTitle: string;
  pageSubtitle: string;
  logoPath: string;
  faviconPath: string;
  heroImagePath: string;
  checkInIntervalMinutes: number;
  successDisplaySeconds: number;
  checkOutIntervalMinutes: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: "",
    pageTitle: "",
    pageSubtitle: "",
    logoPath: "",
    faviconPath: "",
    heroImagePath: "",
    checkInIntervalMinutes: 10,
    successDisplaySeconds: 10,
    checkOutIntervalMinutes: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [cardTemplate, setCardTemplate] = useState<string>("");
  const [isCustomTemplate, setIsCustomTemplate] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [hasSuccessSound, setHasSuccessSound] = useState(false);
  const [hasErrorSound, setHasErrorSound] = useState(false);
  const [imageRefreshKey, setImageRefreshKey] = useState(Date.now());
  const [previewImages, setPreviewImages] = useState<{
    logo?: string;
    favicon?: string;
    hero?: string;
  }>({});
  const [pendingFiles, setPendingFiles] = useState<{
    logo?: File;
    favicon?: File;
    hero?: File;
    cardTemplate?: File;
    successSound?: File;
    errorSound?: File;
  }>({});
  const [pendingTemplate, setPendingTemplate] = useState<string>(""); // プレビュー用SVGテキスト
  const [pendingAudioUrls, setPendingAudioUrls] = useState<{
    success?: string;
    error?: string;
  }>({}); // プレビュー用の音声URL
  const [audioToDelete, setAudioToDelete] = useState<{
    success: boolean;
    error: boolean;
  }>({ success: false, error: false }); // 削除マーク
  const [imagesToDelete, setImagesToDelete] = useState<{
    logo: boolean;
    favicon: boolean;
    hero: boolean;
  }>({ logo: false, favicon: false, hero: false }); // 画像削除マーク
  const router = useRouter();
  const fileInputRefs = {
    logo: useRef<HTMLInputElement>(null),
    favicon: useRef<HTMLInputElement>(null),
    hero: useRef<HTMLInputElement>(null),
    cardTemplate: useRef<HTMLInputElement>(null),
    successSound: useRef<HTMLInputElement>(null),
    errorSound: useRef<HTMLInputElement>(null),
  };

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(apiUrl("/api/admin/check"));
        const data = await response.json();

        if (!data.authenticated) {
          router.push("/admin/login");
          return;
        }

        setAuthChecked(true);
        fetchSettings();
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/admin/login");
      }
    };

    checkAuth();
  }, [router]);

  // 設定取得
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl("/api/admin/settings"));
      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Fetch settings error:", error);
      alert("設定の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // カードテンプレート取得
  const fetchCardTemplate = async () => {
    try {
      setTemplateLoading(true);
      const response = await fetch(apiUrl("/api/settings/template"));
      const data = await response.json();

      if (response.ok) {
        setCardTemplate(data.template);
        setIsCustomTemplate(data.isCustom);
      }
    } catch (error) {
      console.error("Fetch template error:", error);
    } finally {
      setTemplateLoading(false);
    }
  };

  // カードテンプレート選択時のプレビュー処理
  const handleCardTemplateSelect = async (file: File) => {
    try {
      const text = await file.text();

      // 基本的な検証
      if (!text.includes("NAME") || !text.includes("XXXX")) {
        alert('テンプレートには "NAME" と "XXXX" のプレースホルダーが必要です');
        return;
      }

      // ファイルとプレビューを保持
      setPendingFiles((prev) => ({
        ...prev,
        cardTemplate: file,
      }));
      setPendingTemplate(text);
    } catch (error) {
      console.error("Template read error:", error);
      alert("テンプレートの読み込みエラーが発生しました");
    }
  };

  // カードテンプレートリセット
  const handleResetCardTemplate = async () => {
    if (!confirm("デフォルトテンプレートに戻しますか?")) return;

    try {
      const response = await fetch(apiUrl("/api/settings/template"), {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        alert("デフォルトテンプレートに戻しました");
        fetchCardTemplate();
      } else {
        alert(data.error || "リセットに失敗しました");
      }
    } catch (error) {
      console.error("Reset template error:", error);
      alert("リセットエラーが発生しました");
    }
  };

  // 音声ファイルの選択（保存前にファイルを保持）
  const handleAudioSelect = (type: "success" | "error", file: File) => {
    // ファイルを保持
    setPendingFiles((prev) => ({
      ...prev,
      [`${type}Sound`]: file,
    }));

    // プレビュー用のURLを生成
    const audioUrl = URL.createObjectURL(file);
    setPendingAudioUrls((prev) => ({
      ...prev,
      [type]: audioUrl,
    }));
  };

  // 音声ファイルの削除（保存前にファイルをクリア）
  const handleAudioRemove = (type: "success" | "error") => {
    // 保留中のファイルがある場合はそれをクリア
    if (pendingFiles[`${type}Sound` as keyof typeof pendingFiles]) {
      setPendingFiles((prev) => {
        const newFiles = { ...prev };
        delete newFiles[`${type}Sound` as keyof typeof newFiles];
        return newFiles;
      });

      // プレビューURLをクリア
      setPendingAudioUrls((prev) => {
        const newUrls = { ...prev };
        if (newUrls[type]) {
          URL.revokeObjectURL(newUrls[type]!);
          delete newUrls[type];
        }
        return newUrls;
      });
    } else if (
      (type === "success" && hasSuccessSound) ||
      (type === "error" && hasErrorSound)
    ) {
      // 既存のカスタム音声がある場合は削除マークを付ける
      setAudioToDelete((prev) => ({
        ...prev,
        [type]: true,
      }));
    }
  };

  // 音声ファイルの状態を取得
  const fetchAudioStatus = async () => {
    try {
      const response = await fetch(apiUrl("/api/admin/settings/audio-status"));
      const data = await response.json();

      if (data.success) {
        setHasSuccessSound(data.hasSuccessSound);
        setHasErrorSound(data.hasErrorSound);
      }
    } catch (error) {
      console.error("Fetch audio status error:", error);
    }
  };

  // 音声テスト再生
  const playTestSound = async (type: "success" | "error") => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const cacheBuster = `?t=${Date.now()}`; // キャッシュ回避

    // 保留中の音声があればそれを再生
    if (pendingAudioUrls[type]) {
      try {
        const audio = new Audio(pendingAudioUrls[type]);
        await audio.play();
        console.log(`Playing pending audio: ${pendingAudioUrls[type]}`);
        return;
      } catch (error) {
        console.error("Failed to play pending audio:", error);
      }
    }

    // APIエンドポイント経由で音声を取得（カスタム音声またはデフォルト音声）
    // 削除マークがついている場合は、APIがデフォルト音声を返すように
    // uploadsディレクトリのファイルを削除する必要はない（保存時に削除される）
    try {
      const audio = new Audio(`${basePath}/api/sounds/${type}${cacheBuster}`);
      await audio.play();
      console.log(`Playing audio via API: ${basePath}/api/sounds/${type}`);
      return; // 再生成功
    } catch (error) {
      console.error("Failed to play audio via API:", error);
      // APIが失敗した場合はアラートを表示
      alert("音声ファイルの再生に失敗しました。");
    }
  };

  // カードテンプレート取得をコンポーネントマウント時に実行
  useEffect(() => {
    if (authChecked) {
      fetchCardTemplate();
      fetchAudioStatus();
    }
  }, [authChecked]);

  // 設定保存
  const handleSave = async () => {
    try {
      setSaving(true);

      // 保留中の画像ファイルをアップロード（設定の更新は不要、自動検索される）
      for (const type of ["logo", "favicon", "hero"] as const) {
        const file = pendingFiles[type];
        if (file) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", type);

            const uploadResponse = await fetch(
              apiUrl("/api/admin/settings/upload"),
              {
                method: "POST",
                body: formData,
              }
            );

            const uploadData = await uploadResponse.json();

            if (!uploadData.success) {
              alert(
                `${type}のアップロードに失敗しました: ${uploadData.message}`
              );
            }
          } catch (uploadError) {
            console.error(`Failed to upload ${type}:`, uploadError);
            alert(`${type}のアップロードエラーが発生しました`);
          }
        }
      }

      // 保留中のカードテンプレートをアップロード
      if (pendingFiles.cardTemplate && pendingTemplate) {
        try {
          const response = await fetch(apiUrl("/api/settings/template"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ template: pendingTemplate }),
          });

          const data = await response.json();

          if (!response.ok) {
            alert(data.error || "カードテンプレートの保存に失敗しました");
          }
        } catch (templateError) {
          console.error("Failed to upload template:", templateError);
          alert("カードテンプレートのアップロードエラーが発生しました");
        }
      }

      // 保留中の音声ファイルをアップロード
      for (const type of ["success", "error"] as const) {
        const fileKey = `${type}Sound` as keyof typeof pendingFiles;
        const file = pendingFiles[fileKey];
        if (file) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", type);

            const uploadResponse = await fetch(
              apiUrl("/api/admin/settings/upload-audio"),
              {
                method: "POST",
                body: formData,
              }
            );

            const uploadData = await uploadResponse.json();

            if (!uploadData.success) {
              alert(
                `${
                  type === "success" ? "成功音" : "エラー音"
                }のアップロードに失敗しました: ${uploadData.message}`
              );
            }
          } catch (uploadError) {
            console.error(`Failed to upload ${type} sound:`, uploadError);
            alert(
              `${
                type === "success" ? "成功音" : "エラー音"
              }のアップロードエラーが発生しました`
            );
          }
        }
      }

      // 削除マークがついた音声ファイルを削除
      for (const type of ["success", "error"] as const) {
        if (audioToDelete[type]) {
          try {
            const response = await fetch(
              apiUrl(`/api/admin/settings/upload-audio?type=${type}`),
              {
                method: "DELETE",
              }
            );

            const data = await response.json();

            if (!data.success) {
              alert(
                `${
                  type === "success" ? "成功音" : "エラー音"
                }の削除に失敗しました: ${data.message}`
              );
            }
          } catch (deleteError) {
            console.error(`Failed to delete ${type} sound:`, deleteError);
            alert(
              `${
                type === "success" ? "成功音" : "エラー音"
              }の削除エラーが発生しました`
            );
          }
        }
      }

      // 削除マークがついた画像ファイルを削除
      for (const type of ["logo", "favicon", "hero"] as const) {
        if (imagesToDelete[type]) {
          try {
            // 拡張子のリストで試行
            const extensions =
              type === "logo"
                ? ["svg", "png", "jpeg", "jpg"]
                : type === "favicon"
                ? ["png", "ico", "svg"]
                : ["png", "jpeg", "jpg", "webp"];

            for (const ext of extensions) {
              const filename = `${type}.${ext}`;
              const filepath = `public/uploads/${filename}`;

              // ファイル削除APIを使用（音声と同じパターン）
              // 実際にはファイルシステムから直接削除する必要がある
              try {
                const response = await fetch(
                  apiUrl(
                    `/api/admin/settings/delete-image?type=${type}&ext=${ext}`
                  ),
                  {
                    method: "DELETE",
                  }
                );

                // エラーは無視（ファイルが存在しない可能性があるため）
              } catch (error) {
                // 無視
              }
            }
          } catch (deleteError) {
            console.error(`Failed to delete ${type} image:`, deleteError);
          }
        }
      }

      // 基本設定を保存（画像パスは自動検索されるため含めない）
      const response = await fetch(apiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        // 保留中のファイルとプレビューをクリア
        setPendingFiles({});
        setPreviewImages({});
        setPendingTemplate("");
        // 保留中の音声URLをクリア
        Object.values(pendingAudioUrls).forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        });
        setPendingAudioUrls({});
        // 削除マークをクリア
        setAudioToDelete({ success: false, error: false });
        setImagesToDelete({ logo: false, favicon: false, hero: false });
        setImageRefreshKey(Date.now());
        // 設定を再読み込み（画像パスが自動更新される）
        await fetchSettings();
        // カードテンプレートと音声状態を再読み込み
        fetchCardTemplate();
        fetchAudioStatus();
        alert("設定を保存しました");
        // ページをリロードしてレイアウトのロゴも更新
        window.location.reload();
      } else {
        alert(data.message || "保存に失敗しました");
      }
    } catch (error) {
      console.error("Save settings error:", error);
      alert("保存エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  // ファイル選択時のプレビュー処理
  const handleFileSelect = (type: "logo" | "favicon" | "hero", file: File) => {
    // ファイルを保持
    setPendingFiles((prev) => ({
      ...prev,
      [type]: file,
    }));

    // 削除マークをクリア（新しいファイルを選択したので）
    setImagesToDelete((prev) => ({
      ...prev,
      [type]: false,
    }));

    // プレビュー用のURLを生成
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      setPreviewImages((prev) => ({
        ...prev,
        [type]: previewUrl,
      }));
    };
    reader.readAsDataURL(file);
  };

  // エクスポート
  const handleExport = () => {
    window.location.href = apiUrl("/api/admin/settings/export");
  };

  // インポート
  const handleImport = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(apiUrl("/api/admin/settings/import"), {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
        alert(data.message || "設定をインポートしました");
        // ページをリロードして画像を反映
        window.location.reload();
      } else {
        alert(data.message || "インポートに失敗しました");
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("インポートエラーが発生しました");
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {!authChecked ? "認証確認中..." : "読み込み中..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* ヘッダー */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">サイト設定</h1>
            <p className="mt-2 text-sm text-gray-600">
              サイトの外観とテキストをカスタマイズ
            </p>
          </div>

          {/* 設定フォーム */}
          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            {/* サイト名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                サイト名 *
              </label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) =>
                  setSettings({ ...settings, siteName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="M-Pass"
              />
            </div>

            {/* ページタイトル */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ページタイトル *
              </label>
              <input
                type="text"
                value={settings.pageTitle}
                onChange={(e) =>
                  setSettings({ ...settings, pageTitle: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="M-Pass"
              />
              <p className="mt-1 text-xs text-gray-500">
                トップページのメインタイトル
              </p>
            </div>

            {/* サブタイトル */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                サブタイトル
              </label>
              <input
                type="text"
                value={settings.pageSubtitle}
                onChange={(e) =>
                  setSettings({ ...settings, pageSubtitle: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="QRコードを使った入退室管理システム"
              />
              <p className="mt-1 text-xs text-gray-500">トップページの説明文</p>
            </div>

            {/* 再チェックイン間隔 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                再チェックイン制限時間（分）
              </label>
              <input
                type="number"
                min="1"
                value={settings.checkInIntervalMinutes || 10}
                onChange={(e) =>
                  setSettings({ ...settings, checkInIntervalMinutes: parseInt(e.target.value, 10) || 10 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="10"
              />
              <p className="mt-1 text-xs text-gray-500">同一メンバーが再度チェックイン可能になるまでの時間制限（分）です（デフォルト: 10分）</p>
            </div>

            {/* チェックイン表示時間 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                チェックイン成功画面表示時間（秒）
              </label>
              <input
                type="number"
                min="1"
                value={settings.successDisplaySeconds || 10}
                onChange={(e) =>
                  setSettings({ ...settings, successDisplaySeconds: parseInt(e.target.value, 10) || 10 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="10"
              />
              <p className="mt-1 text-xs text-gray-500">チェックイン成功時に、登録者情報を画面に表示する時間（秒）です（デフォルト: 10秒）</p>
            </div>

            {/* チェックアウト延長制限時間 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                チェックアウト延長制限時間（分）
              </label>
              <input
                type="number"
                min="0"
                value={settings.checkOutIntervalMinutes === undefined ? 10 : settings.checkOutIntervalMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, checkOutIntervalMinutes: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="10"
              />
              <p className="mt-1 text-xs text-gray-500">チェックアウト後に再スキャンした際、退室時刻の更新（延長）とする時間制限（分）です（0分以上、デフォルト: 10分）</p>
            </div>

            {/* ロゴ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ページロゴ
              </label>
              <div className="flex items-center gap-4">
                {(previewImages.logo || settings.logoPath) && (
                  <img
                    key={`logo-${imageRefreshKey}`}
                    src={
                      previewImages.logo ||
                      `${settings.logoPath}?t=${imageRefreshKey}`
                    }
                    alt="Logo"
                    className="max-h-24 object-contain"
                  />
                )}
                <input
                  type="file"
                  ref={fileInputRefs.logo}
                  accept="image/svg+xml,image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect("logo", file);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.logo.current?.click()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  ファイル選択
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const resourcePath = apiUrl("/api/resource/logo.png");
                    setSettings({ ...settings, logoPath: resourcePath });
                    setPreviewImages((prev) => ({
                      ...prev,
                      logo: resourcePath,
                    }));
                    setPendingFiles((prev) => {
                      const newFiles = { ...prev };
                      delete newFiles.logo;
                      return newFiles;
                    });
                    // 削除マークを付ける
                    setImagesToDelete((prev) => ({
                      ...prev,
                      logo: true,
                    }));
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  デフォルトに戻す
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                SVG, PNG, JPEG（5MB以下）
              </p>
            </div>

            {/* Favicon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Favicon
              </label>
              <div className="flex items-center gap-4">
                {(previewImages.favicon || settings.faviconPath) && (
                  <img
                    key={`favicon-${imageRefreshKey}`}
                    src={
                      previewImages.favicon ||
                      `${settings.faviconPath}?t=${imageRefreshKey}`
                    }
                    alt="Favicon"
                    className="max-h-16 object-contain"
                  />
                )}
                <input
                  type="file"
                  ref={fileInputRefs.favicon}
                  accept="image/x-icon,image/png,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect("favicon", file);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.favicon.current?.click()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  ファイル選択
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const resourcePath = apiUrl("/api/resource/favicon.png");
                    setSettings({ ...settings, faviconPath: resourcePath });
                    setPreviewImages((prev) => ({
                      ...prev,
                      favicon: resourcePath,
                    }));
                    setPendingFiles((prev) => {
                      const newFiles = { ...prev };
                      delete newFiles.favicon;
                      return newFiles;
                    });
                    // 削除マークを付ける
                    setImagesToDelete((prev) => ({
                      ...prev,
                      favicon: true,
                    }));
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  デフォルトに戻す
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                ICO, PNG, SVG（5MB以下）
              </p>
            </div>

            {/* ヒーロー画像 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                トップページのキャッチ画像
              </label>
              <div className="flex items-center gap-4">
                {(previewImages.hero || settings.heroImagePath) && (
                  <img
                    key={`hero-${imageRefreshKey}`}
                    src={
                      previewImages.hero ||
                      `${settings.heroImagePath}?t=${imageRefreshKey}`
                    }
                    alt="Hero"
                    className="max-h-32 object-contain"
                  />
                )}
                <input
                  type="file"
                  ref={fileInputRefs.hero}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect("hero", file);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.hero.current?.click()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  ファイル選択
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const resourcePath = apiUrl("/api/resource/hero.png");
                    setSettings({ ...settings, heroImagePath: resourcePath });
                    setPreviewImages((prev) => ({
                      ...prev,
                      hero: resourcePath,
                    }));
                    setPendingFiles((prev) => {
                      const newFiles = { ...prev };
                      delete newFiles.hero;
                      return newFiles;
                    });
                    // 削除マークを付ける
                    setImagesToDelete((prev) => ({
                      ...prev,
                      hero: true,
                    }));
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  デフォルトに戻す
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                PNG, JPEG, WebP（5MB以下）
              </p>
            </div>

            {/* カードテンプレート */}
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                カードテンプレート
              </label>
              <p className="text-sm text-gray-600 mb-2">
                QRコード発行時に印刷するカードのテンプレート（SVG形式）を設定できます。
              </p>
              <ul className="text-sm text-gray-600 mb-3 list-disc list-inside space-y-1">
                <li>テンプレート内の「NAME」が訪問者名に置き換えられます</li>
                <li>
                  テンプレート内の「XXXX」がQRコード（4桁ID）に置き換えられます
                </li>
                <li>
                  SVG内に
                  <code className="bg-gray-100 px-1 rounded">id="QR"</code>
                  属性を持つ要素（例：&lt;rect id="QR"
                  ...&gt;）があれば、その要素がQR画像に置き換えられます
                </li>
              </ul>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    ref={fileInputRefs.cardTemplate}
                    accept=".svg,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCardTemplateSelect(file);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.cardTemplate.current?.click()}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    ファイル選択
                  </button>
                  {isCustomTemplate && !pendingTemplate && (
                    <button
                      type="button"
                      onClick={handleResetCardTemplate}
                      className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                    >
                      デフォルトに戻す
                    </button>
                  )}
                  <span className="text-sm text-gray-600">
                    {templateLoading
                      ? "読み込み中..."
                      : pendingTemplate
                      ? "新しいテンプレートを選択中（未保存）"
                      : isCustomTemplate
                      ? "カスタムテンプレート使用中"
                      : "デフォルトテンプレート使用中"}
                  </span>
                </div>

                {/* プレビュー表示 - 保留中のテンプレートか現在のテンプレートを表示 */}
                {(pendingTemplate || cardTemplate) && (
                  <div className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-auto">
                    <p className="text-xs text-gray-500 mb-2">
                      {pendingTemplate
                        ? "プレビュー（未保存）:"
                        : "現在のテンプレート:"}
                    </p>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: pendingTemplate || cardTemplate,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 音声設定 */}
            <div className="pt-4 border-t">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                チェックイン音声設定
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                チェックイン成功/失敗時の音声ファイルをアップロードできます（MP3,
                WAV, OGG形式）
              </p>

              <div className="space-y-4">
                {/* 成功音 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    成功音
                  </label>
                  <div className="flex items-center gap-4 mb-2">
                    <input
                      type="file"
                      ref={fileInputRefs.successSound}
                      accept="audio/mpeg,audio/wav,audio/ogg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAudioSelect("success", file);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        fileInputRefs.successSound.current?.click()
                      }
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      ファイル選択
                    </button>
                    {(pendingFiles.successSound ||
                      (hasSuccessSound && !audioToDelete.success)) && (
                      <button
                        type="button"
                        onClick={() => handleAudioRemove("success")}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                      >
                        {pendingFiles.successSound
                          ? "選択解除"
                          : "デフォルトに戻す"}
                      </button>
                    )}
                    <span className="text-sm text-gray-600">
                      {pendingFiles.successSound
                        ? `選択中: ${pendingFiles.successSound.name}`
                        : audioToDelete.success
                        ? "削除予定（保存後にデフォルトに戻ります）"
                        : hasSuccessSound
                        ? "カスタム音声使用中"
                        : "デフォルト音声使用中"}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => playTestSound("success")}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
                    >
                      テスト再生
                    </button>
                  </div>
                </div>

                {/* エラー音 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    エラー音
                  </label>
                  <div className="flex items-center gap-4 mb-2">
                    <input
                      type="file"
                      ref={fileInputRefs.errorSound}
                      accept="audio/mpeg,audio/wav,audio/ogg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAudioSelect("error", file);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRefs.errorSound.current?.click()}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      ファイル選択
                    </button>
                    {(pendingFiles.errorSound ||
                      (hasErrorSound && !audioToDelete.error)) && (
                      <button
                        type="button"
                        onClick={() => handleAudioRemove("error")}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                      >
                        {pendingFiles.errorSound
                          ? "選択解除"
                          : "デフォルトに戻す"}
                      </button>
                    )}
                    <span className="text-sm text-gray-600">
                      {pendingFiles.errorSound
                        ? `選択中: ${pendingFiles.errorSound.name}`
                        : audioToDelete.error
                        ? "削除予定（保存後にデフォルトに戻ります）"
                        : hasErrorSound
                        ? "カスタム音声使用中"
                        : "デフォルト音声使用中"}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => playTestSound("error")}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
                    >
                      テスト再生
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
              >
                {saving ? "保存中..." : "設定を保存"}
              </button>
            </div>
          </div>

          {/* インポート/エクスポート */}
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              設定のバックアップ
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  設定のバックアップ（画像含む）
                </p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleExport}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    ダウンロード
                  </button>
                  <label className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 cursor-pointer">
                    アップロード
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImport(file);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  設定と画像データを含む完全なバックアップです
                </p>
              </div>
            </div>
          </div>

          {/* 戻るボタン */}
          <div className="mt-6">
            <Link
              href="/admin/dashboard"
              className="text-blue-600 hover:text-blue-500"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
