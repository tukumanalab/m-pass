# 低メモリ環境での運用ガイド

## 問題の概要

2GB RAM の Ubuntu 環境で PM2 を使用して Next.js アプリケーションを実行すると、メモリ不足により以下の問題が発生します:

- `kswapd0` プロセスの CPU 使用率が高い (スワップ処理)
- システム CPU が 98%以上を占める
- アプリケーションの応答が非常に遅くなる
- Swap が完全に使い切られる

## 実施した対策

### 1. PM2 設定の最適化 (`deploy/ecosystem.config.js`)

- **メモリ制限**: `max_memory_restart: '600M'` (1GB → 600MB)
- **Node.js ヒープサイズ**: `NODE_OPTIONS: '--max-old-space-size=512'`
- **プロセス優先度**: `nice: 10` (CPU 優先度を下げる)
- **再起動制御**: 連続再起動を防ぐための遅延設定

### 2. Next.js 設定の最適化 (`next.config.js`)

- ソースマップ無効化
- ワーカースレッド無効化 (メモリ使用量削減)
- CPU コア数制限

### 3. システム最適化スクリプト (`deploy/optimize-memory.sh`)

```bash
sudo bash deploy/optimize-memory.sh
```

実行内容:

- スワップ設定の最適化 (swappiness: 60 → 10)
- メモリキャッシュのクリア
- 不要なサービスの確認

### 4. 低メモリ対応起動スクリプト (`deploy/start-pm2-lowmem.sh`)

```bash
bash deploy/start-pm2-lowmem.sh
```

機能:

- メモリ状況の事前チェック
- 本番環境のみを起動 (デバッグ環境は別途起動)
- メモリ不足時の警告表示

## 運用手順

### 緊急対応 (現在メモリ不足の場合)

Ubuntu サーバー上で以下を実行:

```bash
# 1. システム最適化
sudo bash /path/to/m-pass/deploy/optimize-memory.sh

# 2. PM2を全て停止
pm2 stop all
pm2 delete all

# 3. 本番環境のみ起動
pm2 start /path/to/m-pass/deploy/ecosystem.config.js --only m-pass

# 4. メモリ監視
pm2 monit
```

### 通常運用

```bash
# プロジェクトディレクトリに移動
cd /path/to/m-pass

# 低メモリ対応スクリプトで起動
bash deploy/start-pm2-lowmem.sh
```

### デバッグ環境の起動 (開発時のみ)

```bash
# 本番環境を停止
pm2 stop m-pass

# デバッグ環境を起動
pm2 start deploy/ecosystem.config.js --only m-pass-debug

# 作業完了後は本番環境に戻す
pm2 stop m-pass-debug
pm2 start deploy/ecosystem.config.js --only m-pass
```

## モニタリングコマンド

```bash
# PM2のメモリ監視
pm2 monit

# システムメモリ確認 (リアルタイム)
watch -n 2 free -h

# プロセス別メモリ使用量
ps aux --sort=-%mem | head -20

# PM2ログ
pm2 logs

# PM2ステータス
pm2 status
```

## 推奨事項

### 短期対策

1. **本番環境のみ稼働**: デバッグ環境は開発時のみ起動
2. **MySQL の見直し**: 使用していない場合は停止
3. **不要なサービスの停止**: Bluetooth、CUPS 等

```bash
# MySQL停止 (使用していない場合)
sudo systemctl stop mysql
sudo systemctl disable mysql

# 不要なサービスの確認
systemctl list-units --type=service --state=running
```

### 長期対策

1. **メモリ増設**: 最低 4GB、推奨 8GB
2. **サーバー移行**: より大きなインスタンスへの移行
3. **アーキテクチャ変更**:
   - デバッグ環境は別サーバーへ
   - 静的ファイルを CDN へ移行

## トラブルシューティング

### アプリが頻繁に再起動する

```bash
# PM2ログで原因確認
pm2 logs --lines 100

# メモリ制限を確認
pm2 show m-pass
```

### それでもメモリ不足の場合

```bash
# 1. PM2完全停止
pm2 kill

# 2. システム再起動を検討
sudo reboot

# 3. 再起動後、最小構成で起動
pm2 start deploy/ecosystem.config.js --only m-pass
```

## 監視指標

### 正常な状態の目安 (対策後の実測値)

```
✅ 理想的な稼働状態
- CPU使用率: 2%以下 (idle 98%以上)
- メモリ使用率: 30%前後 (約500-600MB)
- Swap使用量: 30%以下 (約600MB以下)
- kswapd0 CPU: 0% (完全停止)
- Node.jsプロセス: 50-100MB
```

### 警告レベル

以下の状態が続く場合は要注意:

- **CPU 使用率**: 20%以上が継続
- **メモリ使用率**: 70%以上
- **Swap 使用量**: 50%以上
- **kswapd0 CPU**: 5%以上 (スワップスラッシング発生)

### 危険レベル (即座に対応が必要)

- **CPU (system)**: 50%以上
- **メモリ使用率**: 90%以上
- **Swap 使用量**: 90%以上
- **kswapd0 CPU**: 30%以上
- **利用可能メモリ**: 100MB 以下

このレベルに達した場合は、直ちに:

1. `pm2 stop all` で全プロセスを停止
2. `sudo bash deploy/optimize-memory.sh` でメモリクリア
3. `bash deploy/start-pm2-lowmem.sh` で再起動

## 成功事例

実際の改善事例として、本ガイドの対策により:

- メモリ使用量が **99% → 27%** に削減
- CPU 待機状態が **0% → 98%** に改善
- アプリケーション応答速度が大幅に向上
- 安定稼働を実現 (メモリ余裕 1.4GB 確保)
