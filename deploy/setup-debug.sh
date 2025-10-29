#!/bin/bash

# M-Pass デバッグ環境セットアップスクリプト

set -e

echo "M-Pass デバッグ環境セットアップを開始します..."

# カレントディレクトリを取得
APP_DIR=$(pwd)

# Node.jsのインストール確認
if ! command -v node &> /dev/null; then
    echo "Node.jsをインストールしています..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# PM2のインストール
if ! command -v pm2 &> /dev/null; then
    echo "PM2をインストールしています..."
    sudo npm install -g pm2
fi

# Nginxのインストール
if ! command -v nginx &> /dev/null; then
    echo "Nginxをインストールしています..."
    sudo apt-get update
    sudo apt-get install -y nginx
fi

# 依存関係のインストール
echo "依存関係をインストールしています..."
npm install

# 本番環境のビルド
echo "本番環境をビルドしています..."
npm run build

# デバッグ環境のビルド
echo "デバッグ環境をビルドしています..."
npm run build:debug

# PM2設定ファイルのパス更新
echo "PM2設定ファイルを更新しています..."
sed -i "s|/path/to/m-pass|${APP_DIR}|g" deploy/ecosystem.config.js

# PM2で両方のアプリケーションを起動
echo "PM2でアプリケーションを起動しています..."
pm2 delete m-pass 2>/dev/null || true
pm2 delete m-pass-debug 2>/dev/null || true
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup

# Nginx設定
echo "Nginx設定をコピーしています..."
sudo cp deploy/nginx-debug.conf /etc/nginx/sites-available/m-pass
sudo ln -sf /etc/nginx/sites-available/m-pass /etc/nginx/sites-enabled/m-pass
sudo rm -f /etc/nginx/sites-enabled/default

# Nginxのテストと再起動
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "✅ デバッグ環境のセットアップが完了しました！"
echo ""
echo "アプリケーションは以下で実行されています："
echo "- 本番環境 Next.js: http://localhost:3000"
echo "- デバッグ環境 Next.js: http://localhost:3001"
echo "- 本番環境 Nginx: https://tukumana.si.aoyama.ac.jp/members"
echo "- デバッグ環境 Nginx: https://tukumana.si.aoyama.ac.jp/members-debug"
echo ""
echo "PM2コマンド："
echo "- pm2 status              # ステータス確認"
echo "- pm2 logs m-pass         # 本番環境ログ確認"
echo "- pm2 logs m-pass-debug   # デバッグ環境ログ確認"
echo "- pm2 restart m-pass      # 本番環境再起動"
echo "- pm2 restart m-pass-debug # デバッグ環境再起動"
echo "- pm2 stop m-pass         # 本番環境停止"
echo "- pm2 stop m-pass-debug   # デバッグ環境停止"
echo ""
echo "デバッグ環境のデータベースは別ファイル (members-debug.db) に保存されます。"
echo ""
