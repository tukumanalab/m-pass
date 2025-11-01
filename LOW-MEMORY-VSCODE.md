# VS Code Remote - 低メモリ環境向け設定ガイド

## 環境情報
- **OS**: Ubuntu (リモート)
- **メモリ**: 2GB
- **問題**: TypeScript言語サーバーのクラッシュ

## 実施済み最適化設定

### 1. TypeScriptサーバーのメモリ制限
```jsonc
"typescript.tsserver.maxTsServerMemory": 512  // 2GB環境では512MBが適切
```

### 2. ファイル監視の最適化
不要なディレクトリ・ファイルの監視を除外:
- `node_modules`, `.next`, `build`, `dist`, `logs`
- `*.db`, `*.log` ファイル
- `public/uploads` (アップロードファイル)

### 3. エディタ機能の最適化
```jsonc
"editor.formatOnSave": false              // 自動フォーマット無効化
"editor.codeActionsOnSave": "never"       // ESLint自動修正無効化
"editor.suggest.showWords": false         // 単語提案無効化
```

### 4. Git機能の最適化
```jsonc
"git.autofetch": false                    // 自動フェッチ無効化
"git.decorations.enabled": false          // Git装飾無効化
```

### 5. GitHub Copilotの最適化
TypeScriptファイルのみでCopilotを有効化:
- YAML, Markdown, JSON等では無効化

### 6. ターミナルの最適化
```jsonc
"terminal.integrated.scrollback": 1000           // 履歴を1000行に制限
"terminal.integrated.enablePersistentSessions": false
```

## VS Code リロード手順

設定変更後、必ずVS Codeをリロードしてください:

1. `Ctrl+Shift+P` を押す
2. `Developer: Reload Window` を選択して実行

または、TypeScriptサーバーのみ再起動:
1. `Ctrl+Shift+P` を押す
2. `TypeScript: Restart TS server` を選択

## トラブルシューティング

### 1. まだクラッシュする場合

**メモリ使用状況を確認:**
```bash
free -h
htop  # またはtop
```

**Node.jsプロセスのメモリ確認:**
```bash
ps aux | grep node | grep -v grep
```

### 2. TypeScriptサーバーのメモリをさらに削減

`.vscode/settings.json`で以下を変更:
```jsonc
"typescript.tsserver.maxTsServerMemory": 384  // 512 → 384MB
```

### 3. GitHub Copilot Chatを一時的に無効化

警告メッセージが示唆している場合:
1. 左サイドバーの拡張機能アイコンをクリック
2. `GitHub Copilot Chat` を探す
3. `無効にする` をクリック

### 4. スワップメモリの確認・追加

システムメモリが不足している場合:
```bash
# スワップの確認
swapon --show
free -h

# スワップの追加 (1GB)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永続化
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 5. 不要な拡張機能の無効化

メモリを消費する拡張機能を確認:
1. `Ctrl+Shift+P` → `Extensions: Show Running Extensions`
2. メモリ使用量の多い拡張機能を無効化

推奨: 最小限の拡張機能のみ有効化
- TypeScript and JavaScript Language Features (組み込み)
- ESLint
- Prettier
- GitHub Copilot (オプション)

### 6. Docker環境との併用時

Dockerコンテナもメモリを消費するため:
```bash
# コンテナのメモリ使用状況確認
docker stats --no-stream

# 不要なコンテナの停止
docker-compose stop
```

## メモリ使用量の目安

2GB環境での理想的な配分:
- **OS/システム**: ~512MB
- **VS Code本体**: ~256-384MB
- **TypeScript言語サーバー**: ~384-512MB
- **Node.js開発サーバー**: ~512MB
- **Docker (使用時)**: ~256-512MB
- **その他**: ~256MB

合計が2GBを超えないように調整が必要です。

## パフォーマンス改善のヒント

1. **作業中はDockerを停止**: 開発サーバーを直接実行
2. **ブラウザタブを最小限に**: Chromeもメモリを消費
3. **VS Code以外のアプリを閉じる**: メモリリソースを集中
4. **定期的なVS Codeの再起動**: メモリリークを防ぐ

## 関連ドキュメント

- [LOW-MEMORY-OPERATION.md](./LOW-MEMORY-OPERATION.md) - アプリケーション実行時のメモリ最適化
- [DEBUG.md](./DEBUG.md) - デバッグ環境の設定
- [DEV-SETUP.md](./DEV-SETUP.md) - 開発環境のセットアップ
