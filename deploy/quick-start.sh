#!/bin/bash

# M-Pass クイックスタートスクリプト
# サーバー再起動後やデプロイ後にアプリケーションを起動するスクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 M-Pass クイックスタート"
echo "======================================"

# プロジェクトディレクトリに移動
cd "$PROJECT_DIR"

# PM2プロセスの確認
echo ""
echo "📊 現在のPM2プロセス:"
pm2 list

# m-passが既に起動しているか確認
if pm2 describe m-pass > /dev/null 2>&1; then
    echo ""
    echo "⚠️  m-passは既に起動しています"
    read -p "再起動しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 m-passを再起動しています..."
        pm2 restart m-pass
    else
        echo "✅ スキップしました"
        exit 0
    fi
else
    echo ""
    echo "🆕 m-passを起動しています..."
    pm2 start deploy/pm2.config.js
fi

# プロセスリストを保存
echo ""
echo "💾 PM2プロセスリストを保存しています..."
pm2 save

# ステータス確認
echo ""
echo "📊 最新のPM2プロセス:"
pm2 list

echo ""
echo "✅ 完了しました！"
echo ""
echo "📝 次のコマンドでログを確認できます:"
echo "   pm2 logs m-pass"
echo ""
echo "🌐 アプリケーションにアクセス:"
echo "   http://localhost:3000 (直接)"
echo "   http://localhost:8080/members (Nginx経由)"
