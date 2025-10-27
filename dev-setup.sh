#!/bin/bash

# Mac + VSCode用 M-Pass デバッグ環境セットアップスクリプト

set -e

echo "🚀 M-Pass ローカルデバッグ環境セットアップを開始します..."

# Dockerのインストール確認
if ! command -v docker &> /dev/null; then
    echo "❌ Dockerがインストールされていません"
    echo "Docker Desktop for Mac をインストールしてください："
    echo "https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Docker Composeのインストール確認
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo "❌ Docker Composeがインストールされていません"
    exit 1
fi

# 依存関係のインストール
echo "📦 依存関係をインストールしています..."
npm install

# 本番環境のビルド
echo "🔨 本番環境をビルドしています..."
npm run build

# デバッグ環境のビルド
echo "🔨 デバッグ環境をビルドしています..."
npm run build:debug

# Docker Composeで起動
echo "🐳 Docker環境を起動しています..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build

echo ""
echo "✅ セットアップが完了しました！"
echo ""
echo "🌐 アクセスURL："
echo "  - 本番環境:     http://localhost:8080/member"
echo "  - デバッグ環境: http://localhost:8080/member-debug"
echo ""
echo "🔧 直接アクセス（Nginxバイパス）："
echo "  - 本番環境:     http://localhost:3000"
echo "  - デバッグ環境: http://localhost:3001"
echo ""
echo "📊 Docker コマンド："
echo "  - docker-compose logs -f          # 全ログ表示"
echo "  - docker-compose logs -f app      # 本番環境ログ"
echo "  - docker-compose logs -f app-debug # デバッグ環境ログ"
echo "  - docker-compose logs -f nginx    # Nginxログ"
echo "  - docker-compose restart app      # 本番環境再起動"
echo "  - docker-compose restart app-debug # デバッグ環境再起動"
echo "  - docker-compose down             # 全コンテナ停止・削除"
echo "  - docker-compose up -d            # 全コンテナ起動"
echo ""
echo "🛑 停止するには："
echo "  docker-compose down"
echo ""
