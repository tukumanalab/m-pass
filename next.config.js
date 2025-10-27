/** @type {import('next').NextConfig} */
const nextConfig = {
  // 環境変数でbasePathを設定 (例: /member, /member-debug など)
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
}

module.exports = nextConfig
