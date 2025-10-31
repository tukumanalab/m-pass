#!/bin/bash

# MySQLが必要かチェックし、不要なら停止するスクリプト

echo "=== MySQL使用状況チェック ==="

# MySQLが稼働しているか確認
if systemctl is-active --quiet mysql; then
    echo "✓ MySQLは稼働中です"
    
    # データベース接続をチェック
    DB_CONNECTIONS=$(sudo mysql -e "SHOW PROCESSLIST;" 2>/dev/null | grep -v "Id" | wc -l)
    
    if [ "$DB_CONNECTIONS" -le 1 ]; then
        echo "⚠️  MySQLへの接続がありません（接続数: $DB_CONNECTIONS）"
        echo ""
        echo "このアプリケーションはSQLiteを使用しています。"
        echo "MySQLが不要な場合は、以下のコマンドで停止できます："
        echo ""
        echo "  sudo systemctl stop mysql"
        echo "  sudo systemctl disable mysql"
        echo ""
        echo "メモリを約100-200MB節約できます。"
    else
        echo "✓ MySQLは使用されています（接続数: $DB_CONNECTIONS）"
    fi
else
    echo "✓ MySQLは停止しています"
fi
