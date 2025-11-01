#!/bin/bash

# 管理者アクセスログ確認ヘルパースクリプト

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_LOG_DIR="$HOME/.pm2/logs"

echo "==================================="
echo "管理者アクセスログ確認"
echo "==================================="
echo ""

# ログファイルの存在確認
if [ ! -d "$PM2_LOG_DIR" ]; then
    echo "❌ PM2ログディレクトリが見つかりません: $PM2_LOG_DIR"
    exit 1
fi

# 確認するログファイル
PROD_OUT_LOG="$PM2_LOG_DIR/m-pass-out.log"
PROD_ERR_LOG="$PM2_LOG_DIR/m-pass-error.log"

# メニュー表示
echo "確認したいログを選択してください："
echo ""
echo "1) リアルタイムでログを監視（全ログ）"
echo "2) 管理者関連ログのみ表示（最新100行）"
echo "3) ログイン試行の履歴（最新50件）"
echo "4) 拒否されたアクセスの履歴（最新50件）"
echo "5) 成功したログインの履歴（最新50件）"
echo "6) 今日の管理者アクセス履歴（全件）"
echo "7) ログファイルの場所を表示"
echo "8) 終了"
echo ""

read -p "選択 [1-8]: " choice

case $choice in
    1)
        echo ""
        echo "📋 リアルタイムログ監視を開始します（Ctrl+C で終了）..."
        echo ""
        pm2 logs m-pass
        ;;
    2)
        echo ""
        echo "📋 管理者関連ログ（最新100行）："
        echo ""
        pm2 logs m-pass --lines 100 --nostream | grep -i "admin"
        ;;
    3)
        echo ""
        echo "📋 ログイン試行の履歴（最新50件）："
        echo ""
        if [ -f "$PROD_OUT_LOG" ] || [ -f "$PROD_ERR_LOG" ]; then
            cat "$PROD_OUT_LOG" "$PROD_ERR_LOG" 2>/dev/null | grep "ADMIN LOGIN" | tail -50
        else
            pm2 logs m-pass --lines 500 --nostream | grep "ADMIN LOGIN" | tail -50
        fi
        ;;
    4)
        echo ""
        echo "⚠️  拒否されたアクセスの履歴（最新50件）："
        echo ""
        if [ -f "$PROD_OUT_LOG" ] || [ -f "$PROD_ERR_LOG" ]; then
            cat "$PROD_OUT_LOG" "$PROD_ERR_LOG" 2>/dev/null | grep -i "denied" | tail -50
        else
            pm2 logs m-pass --lines 500 --nostream | grep -i "denied" | tail -50
        fi
        ;;
    5)
        echo ""
        echo "✓ 成功したログインの履歴（最新50件）："
        echo ""
        if [ -f "$PROD_OUT_LOG" ] || [ -f "$PROD_ERR_LOG" ]; then
            cat "$PROD_OUT_LOG" "$PROD_ERR_LOG" 2>/dev/null | grep "LOGIN SUCCESS" | tail -50
        else
            pm2 logs m-pass --lines 500 --nostream | grep "LOGIN SUCCESS" | tail -50
        fi
        ;;
    6)
        echo ""
        echo "📅 今日の管理者アクセス履歴："
        echo ""
        TODAY=$(date +"%Y-%m-%d")
        if [ -f "$PROD_OUT_LOG" ] || [ -f "$PROD_ERR_LOG" ]; then
            cat "$PROD_OUT_LOG" "$PROD_ERR_LOG" 2>/dev/null | grep "$TODAY" | grep -i "admin"
        else
            pm2 logs m-pass --lines 1000 --nostream | grep "$TODAY" | grep -i "admin"
        fi
        ;;
    7)
        echo ""
        echo "📂 ログファイルの場所："
        echo ""
        echo "出力ログ: $PROD_OUT_LOG"
        echo "エラーログ: $PROD_ERR_LOG"
        echo ""
        echo "PM2ログディレクトリ: $PM2_LOG_DIR"
        echo ""
        ls -lh "$PM2_LOG_DIR" 2>/dev/null | grep "m-pass"
        ;;
    8)
        echo "終了します。"
        exit 0
        ;;
    *)
        echo "❌ 無効な選択です"
        exit 1
        ;;
esac

echo ""
echo "==================================="
