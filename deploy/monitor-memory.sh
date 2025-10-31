#!/bin/bash

# メモリ監視・自動対応スクリプト
# 5分ごとにcronで実行することを推奨

# 閾値設定
MEMORY_THRESHOLD=85  # メモリ使用率85%以上で警告
SWAP_THRESHOLD=70    # Swap使用率70%以上で警告
CRITICAL_MEMORY=95   # 95%以上で緊急対応

# ログファイル
LOG_FILE="/var/log/m-pass-memory-monitor.log"
ALERT_FILE="/tmp/m-pass-memory-alert.flag"

# 現在の状態を取得
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
SWAP_USAGE=$(free | grep Swap | awk '{if($2>0) printf "%.0f", $3/$2 * 100.0; else print "0"}')
AVAILABLE_MEM=$(free -m | grep Mem | awk '{print $7}')

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

echo "[$TIMESTAMP] メモリ: ${MEMORY_USAGE}%, Swap: ${SWAP_USAGE}%, 利用可能: ${AVAILABLE_MEM}MB" >> "$LOG_FILE"

# 緊急レベル: 即座にPM2を再起動
if [ "$MEMORY_USAGE" -ge "$CRITICAL_MEMORY" ] || [ "$AVAILABLE_MEM" -lt 100 ]; then
    echo "[$TIMESTAMP] 🚨 緊急: メモリ使用率が危険レベル (${MEMORY_USAGE}%)" >> "$LOG_FILE"
    
    # 1時間に1回だけ実行（連続実行を防ぐ）
    if [ ! -f "$ALERT_FILE" ] || [ $(find "$ALERT_FILE" -mmin +60 2>/dev/null | wc -l) -gt 0 ]; then
        echo "[$TIMESTAMP] PM2プロセスを再起動します" >> "$LOG_FILE"
        
        # PM2を停止してメモリをクリア
        /usr/bin/pm2 stop all >> "$LOG_FILE" 2>&1
        sleep 5
        
        # メモリキャッシュをクリア
        sync
        echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null
        
        sleep 10
        
        # 本番環境のみ再起動
        cd /srv/m-pass || exit 1
        /usr/bin/pm2 start deploy/ecosystem.config.js --only m-pass >> "$LOG_FILE" 2>&1
        
        # フラグファイルを作成
        touch "$ALERT_FILE"
        
        echo "[$TIMESTAMP] ✅ PM2再起動完了" >> "$LOG_FILE"
    else
        echo "[$TIMESTAMP] ⏭️  最近再起動済みのためスキップ" >> "$LOG_FILE"
    fi

# 警告レベル: ログに記録
elif [ "$MEMORY_USAGE" -ge "$MEMORY_THRESHOLD" ] || [ "$SWAP_USAGE" -ge "$SWAP_THRESHOLD" ]; then
    echo "[$TIMESTAMP] ⚠️  警告: メモリ使用率が高い (メモリ: ${MEMORY_USAGE}%, Swap: ${SWAP_USAGE}%)" >> "$LOG_FILE"
    
    # PM2のメモリ状況を記録
    /usr/bin/pm2 list >> "$LOG_FILE" 2>&1
fi

# 古いログをクリーンアップ（7日以上前のログを削除）
find "$(dirname "$LOG_FILE")" -name "$(basename "$LOG_FILE")" -mtime +7 -delete 2>/dev/null

exit 0
