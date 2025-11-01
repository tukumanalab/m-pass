// .envファイルを明示的に読み込む
require('dotenv').config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 環境変数でbasePathを設定 (例: /members, /members-debug など)
  ...(process.env.BASE_PATH && {
    basePath: process.env.BASE_PATH,
  }),
  turbopack: {
    resolveAlias: {
      'better-sqlite3': 'better-sqlite3',
    },
  },
  serverExternalPackages: ['better-sqlite3', 'bcrypt'],
  // 環境変数をクライアントに公開
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || '',
  },
  // メモリ使用量の最適化
  productionBrowserSourceMaps: false, // ソースマップを無効化してメモリ削減
  // 静的最適化を有効化
  poweredByHeader: false,
  compress: true,
  // メモリ不足対策: 並列ビルドを制限
  experimental: {
    workerThreads: false,
    cpus: 1
  }
}

module.exports = nextConfig
