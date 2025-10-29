import { loadSettings } from "@/lib/settings";
import Link from "next/link";

export default function Home() {
  const settings = loadSettings();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <div className="mb-8">
          {settings.heroImagePath && (
            <div className="mb-6">
              <img
                src={settings.heroImagePath}
                alt="Hero"
                className="mx-auto max-h-40 object-contain"
              />
            </div>
          )}
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent mb-4">
            {settings.pageTitle}
          </h1>
          <p className="text-xl text-gray-600">{settings.pageSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-12">
          <Link
            href="/member/dashboard"
            className="group block p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border border-green-100"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              マイページ
            </h2>
            <p className="text-gray-600">メンバー情報の確認やサービスの利用</p>
          </Link>

          <Link
            href="/register"
            className="group block p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border border-primary-100"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              メンバー登録
            </h2>
            <p className="text-gray-600">メンバー情報を登録してカードを発行</p>
          </Link>
        </div>

        {/* 管理者リンク */}
        <div className="mt-12 text-center">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            管理者ダッシュボード
          </Link>
        </div>
      </div>
    </div>
  );
}
