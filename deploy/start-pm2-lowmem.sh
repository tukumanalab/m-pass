#!/bin/bash
# PM2起動スクリプト (低メモリ環境対応版)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== M-Pass PM2起動スクリプト (低メモリ対応版) ==="

# メモリ使用状況を確認
echo ""
echo "現在のメモリ状況:"
free -h

# メモリが不足している場合の警告
AVAILABLE_MEM=$(free -m | awk 'NR==2 {print $7}')
if [ "$AVAILABLE_MEM" -lt 500 ]; then
  echo ""
  echo "⚠️  警告: 利用可能メモリが500MB未満です (${AVAILABLE_MEM}MB)"
  echo "推奨: sudo bash deploy/optimize-memory.sh を先に実行してください"
  echo ""
  read -p "続行しますか? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

cd "$PROJECT_ROOT"

# 既存のPM2プロセスを停止
echo ""
echo "既存のPM2プロセスを停止..."
pm2 stop all || true
pm2 delete all || true

# メモリをクリア(キャッシュクリアは要root)
echo ""
echo "PM2ログをクリア..."
pm2 flush

# 少し待機
sleep 2

# PM2起動 (本番環境のみ)
echo ""
echo "本番環境(m-pass)を起動..."
pm2 start deploy/ecosystem.config.js --only m-pass

echo ""
echo "起動完了を待機..."
sleep 5

# ステータス確認
echo ""
echo "=== PM2ステータス ==="
pm2 status

echo ""
echo "=== メモリ使用状況 ==="
pm2 list

echo ""
echo "=== 推奨コマンド ==="
echo "メモリ監視: pm2 monit"
echo "ログ確認: pm2 logs"
echo "システム監視: watch -n 2 free -h"
echo ""
echo "デバッグ環境を起動する場合:"
echo "  pm2 start deploy/ecosystem.config.js --only m-pass-debug"
echo ""
echo "⚠️  2GB RAM環境では両方同時に起動するとメモリ不足になります"
