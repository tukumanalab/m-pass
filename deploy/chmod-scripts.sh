#!/bin/bash

# すべてのスクリプトに実行権限を付与

chmod +x deploy/optimize-memory.sh
chmod +x deploy/start-pm2-lowmem.sh
chmod +x deploy/monitor-memory.sh
chmod +x deploy/check-mysql.sh
chmod +x deploy/emergency-recovery.sh
chmod +x deploy/setup.sh
chmod +x deploy/setup-debug.sh

echo "✅ すべてのスクリプトに実行権限を付与しました"
echo ""
echo "利用可能なスクリプト:"
echo "  deploy/optimize-memory.sh      - システムメモリ最適化"
echo "  deploy/start-pm2-lowmem.sh     - PM2低メモリ対応起動"
echo "  deploy/monitor-memory.sh       - 自動メモリ監視 (cron用)"
echo "  deploy/check-mysql.sh          - MySQL使用状況確認"
echo "  deploy/emergency-recovery.sh   - 緊急メモリ復旧"
echo "  deploy/setup.sh                - 本番環境セットアップ"
echo "  deploy/setup-debug.sh          - デバッグ環境セットアップ"
