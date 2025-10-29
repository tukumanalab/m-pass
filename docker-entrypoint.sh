#!/bin/sh
set -e

# 依存関係が最新かチェック（package.jsonが変更されている場合はインストール）
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo "Installing/updating dependencies..."
  npm ci
fi

# ネイティブモジュールを再ビルド（コンテナ起動時に毎回実行）
echo "Rebuilding native modules for container environment..."
npm rebuild bcrypt better-sqlite3 2>&1 | grep -E "(built|error|Error)" || echo "rebuilt dependencies successfully"

# 元のコマンドを実行
exec "$@"
