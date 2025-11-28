#!/bin/bash

APP_NAME="m-pass"

# 既存のプロセスがあれば停止・削除
echo "Stopping and removing existing $APP_NAME process if it exists..."
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true

# アプリケーションを起動
echo "Starting $APP_NAME..."
pm2 start deploy/ecosystem.config.js --only $APP_NAME

# 現在のプロセスリストを保存（再起動時の復元用）
echo "Saving PM2 process list..."
pm2 save

echo "---------------------------------------------------"
echo "To ensure the app starts on boot, please execute the command output by 'pm2 startup' if you haven't done so previously."
pm2 startup
echo "---------------------------------------------------"
