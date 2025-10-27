#!/bin/bash

# M-Pass Ubuntu Server セットアップスクリプト

set -e

echo "M-Pass セットアップを開始します..."

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

# ビルド
echo "アプリケーションをビルドしています..."
npm run build

# PM2でアプリケーションを起動
echo "PM2でアプリケーションを起動しています..."
pm2 delete m-pass 2>/dev/null || true
pm2 start deploy/pm2.config.js
pm2 save
pm2 startup

# Nginx設定
echo "Nginx設定をコピーしています..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/m-pass
sudo ln -sf /etc/nginx/sites-available/m-pass /etc/nginx/sites-enabled/m-pass
sudo rm -f /etc/nginx/sites-enabled/default

# Nginxのテストと再起動
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "✅ セットアップが完了しました"
echo ""
echo "==================================="
echo "📊 アクセス情報"
echo "==================================="
echo "- Nginx: http://localhost/members (ポート80)"
echo ""
echo "PM2コマンド："
echo "- pm2 status         # ステータス確認"
echo "- pm2 logs m-pass    # ログ確認"
echo "- pm2 restart m-pass # 再起動"
echo "- pm2 stop m-pass    # 停止"
