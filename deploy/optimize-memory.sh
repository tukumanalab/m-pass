#!/bin/bash
# Ubuntu メモリ最適化スクリプト (2GB RAM環境用)

echo "=== メモリ最適化スクリプト ==="
echo "このスクリプトは低メモリ環境でのNode.js/PM2パフォーマンスを改善します"
echo ""

# 管理者権限チェック
if [ "$EUID" -ne 0 ]; then 
  echo "このスクリプトはsudo権限が必要です"
  echo "実行方法: sudo bash optimize-memory.sh"
  exit 1
fi

# 1. スワップ領域の設定確認と最適化
echo "1. スワップ設定を最適化します..."
echo "現在のスワップ設定:"
cat /proc/sys/vm/swappiness
cat /proc/sys/vm/vfs_cache_pressure

# swappinessを10に設定 (デフォルト60→10で物理メモリを優先)
sysctl vm.swappiness=10
sysctl vm.vfs_cache_pressure=50

# 永続化
if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
  echo "vm.swappiness=10" >> /etc/sysctl.conf
  echo "vm.vfs_cache_pressure=50" >> /etc/sysctl.conf
  echo "✓ スワップ設定を永続化しました"
fi

# 2. メモリキャッシュのクリア
echo ""
echo "2. メモリキャッシュをクリアします..."
sync
echo 3 > /proc/sys/vm/drop_caches
echo "✓ キャッシュをクリアしました"

# 3. 不要なサービスの停止候補を表示
echo ""
echo "3. 不要なサービスの停止を検討してください:"
systemctl list-units --type=service --state=running | grep -E "bluetooth|cups|avahi|ModemManager" || echo "停止可能な一般的なサービスは見つかりませんでした"

echo ""
echo "=== 最適化完了 ==="
echo ""
echo "次のステップ:"
echo "1. PM2を再起動: pm2 restart all"
echo "2. メモリ監視: pm2 monit"
echo "3. システム監視: watch -n 2 free -m"
echo ""
echo "推奨事項:"
echo "- 本番環境では最低4GBのメモリを推奨"
echo "- デバッグ環境は開発時のみ起動することを推奨"
echo "- MySQLが必要ない場合は停止を検討"
