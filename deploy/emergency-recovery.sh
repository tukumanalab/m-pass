#!/bin/bash

# 緊急時のメモリ復旧スクリプト
# システムがフリーズしそうな場合に実行

echo "=== 🚨 緊急メモリ復旧スクリプト ==="
echo ""

# 現在の状態を表示
echo "現在のメモリ状態:"
free -h
echo ""

echo "現在のSwap使用状況:"
swapon --show
echo ""

echo "CPU状態:"
top -b -n1 | head -5
echo ""

# 全PM2プロセスを即座に停止
echo "=== ステップ1: すべてのPM2プロセスを停止 ==="
pm2 kill
sleep 3

# 残っているNodeプロセスを確認
NODE_PROCS=$(ps aux | grep -v grep | grep node | wc -l)
if [ "$NODE_PROCS" -gt 0 ]; then
    echo "⚠️  ${NODE_PROCS}個のNodeプロセスがまだ残っています"
    ps aux | grep -v grep | grep node
    echo ""
    echo "これらのプロセスを強制終了しますか? (通常は不要)"
    read -p "続行 (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pkill -9 node
        sleep 2
    fi
fi

# メモリキャッシュをクリア
echo ""
echo "=== ステップ2: メモリキャッシュをクリア ==="
sync
echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null
echo "✓ キャッシュクリア完了"
sleep 2

# Swapをクリア（オプション）
echo ""
echo "Swapをクリアしますか? (時間がかかる場合があります)"
read -p "続行 (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Swapをオフにしています..."
    sudo swapoff -a
    sleep 2
    echo "Swapを再度オンにしています..."
    sudo swapon -a
    echo "✓ Swap再初期化完了"
fi

# MySQLの状態を確認
echo ""
echo "=== ステップ3: MySQLの確認 ==="
if systemctl is-active --quiet mysql; then
    echo "⚠️  MySQLが稼働中です"
    echo "このアプリケーションではMySQLは不要です"
    read -p "MySQLを停止しますか? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl stop mysql
        sudo systemctl disable mysql
        echo "✓ MySQL停止完了"
    fi
else
    echo "✓ MySQLは停止しています"
fi

# 不要なサービスを確認
echo ""
echo "=== ステップ4: 不要なサービスの確認 ==="
echo "メモリを多く使用しているサービス:"
systemctl list-units --type=service --state=running --no-pager | grep -E "bluetooth|cups|avahi" || echo "特になし"

# 待機
echo ""
echo "=== ステップ5: 待機中... ==="
echo "メモリが安定するまで30秒待機します"
for i in {30..1}; do
    echo -ne "\r残り ${i} 秒...  "
    sleep 1
done
echo ""

# 最終状態を表示
echo ""
echo "=== 復旧後の状態 ==="
free -h
echo ""

AVAILABLE_MEM=$(free -m | awk 'NR==2 {print $7}')
echo "利用可能メモリ: ${AVAILABLE_MEM}MB"

if [ "$AVAILABLE_MEM" -gt 800 ]; then
    echo "✅ メモリ状態は良好です (800MB以上)"
    echo ""
    echo "アプリケーションを再起動できます:"
    echo "  bash deploy/start-pm2-lowmem.sh"
elif [ "$AVAILABLE_MEM" -gt 500 ]; then
    echo "⚠️  メモリ状態は中程度です (500-800MB)"
    echo ""
    echo "アプリケーションを再起動できますが、注意が必要です:"
    echo "  bash deploy/start-pm2-lowmem.sh"
else
    echo "🚨 メモリ状態は依然として危険です (500MB未満)"
    echo ""
    echo "推奨対応:"
    echo "1. システムを再起動してください: sudo reboot"
    echo "2. または、他のサービスを停止してください"
    echo "3. 根本的な解決: メモリを増設 (最低4GB推奨)"
fi

echo ""
echo "=== 復旧スクリプト完了 ==="
