#!/bin/bash

# すべてのスクリプトに実行権限を付与

chmod +x deploy/deploy.sh
chmod +x deploy/check-admin-logs.sh

echo "✅ すべてのスクリプトに実行権限を付与しました"
echo ""
echo "利用可能なスクリプト:"
echo "  deploy/deploy.sh               - ビルド成果物のデプロイ (GitHub Actions から自動実行)"
echo "  deploy/check-admin-logs.sh     - 管理者アクセスログの確認"
