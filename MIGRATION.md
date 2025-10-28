# データベースマイグレーション: qr_code → member_id

## 概要

このマイグレーションは、メンバーテーブルの `qr_code` カラムを `member_id` に変更します。

## 変更内容

### データベーススキーマ

- **削除**: `qr_code` カラム
- **追加**: `member_id` カラム（4 桁の英数文字、ユニーク制約あり）
- **データ**: 既存の `qr_code` の値を `member_id` に移行

### API 変更

- QR コード表示には `member_id` が使用されます
- 全ての API エンドポイントが更新されました

### 影響を受けるファイル

#### データベース (`lib/database.ts`)

- `createMember()`: 引数を `qrCode` → `memberId` に変更
- `findMemberByQRCode()` → `findMemberByMemberId()` に変更
- `isQRCodeExists()` → `isMemberIdExists()` に変更
- チェックイン履歴取得時に `member_id` を返すように変更

#### API エンドポイント

- `/api/checkin`: メンバー ID でチェックイン
- `/api/members`: メンバー ID 生成・登録
- `/api/admin/members/[id]`: メンバー ID 表示
- `/api/admin/members/[id]/qrcode`: メンバー ID で QR コード生成
- `/api/admin/members/bulk`: CSV インポート（member_id 列を使用）
- `/api/admin/members/export`: CSV エクスポート（member_id 列を出力）
- `/api/admin/members/search`: メンバー ID 検索
- `/api/checkins/bulk`: CSV インポート（member_id 列を使用）
- `/api/checkins/export`: CSV エクスポート（member_id 列を出力）
- `/api/member/auth`: メンバー ID でログイン
- `/api/member/info`: メンバー ID 情報取得
- `/api/member/qrcode`: メンバー ID で QR コード生成

## マイグレーション手順

### 1. 事前準備

```bash
# 現在のデータベースをバックアップ（念のため）
cp checkin.db checkin.db.manual-backup

# Docker環境の場合はコンテナを停止
docker-compose down
```

### 2. マイグレーション実行

```bash
# マイグレーションスクリプトを実行
node scripts/migrate-qrcode-to-memberid.js
```

スクリプトは自動的に以下を実行します：

1. データベースのバックアップを作成（`checkin.db.backup.TIMESTAMP`）
2. 新しいテーブル構造を作成
3. データを移行（qr_code → member_id）
4. 古いテーブルを削除してリネーム
5. インデックスを再作成

### 3. 動作確認

```bash
# Docker環境を起動
docker-compose up -d

# ログを確認
docker-compose logs -f
```

### 4. 確認事項

- メンバー一覧が正しく表示されるか
- メンバー ID でログインできるか
- QR コードが正しく生成されるか（member_id が表示される）
- チェックインが正しく動作するか
- CSV インポート/エクスポートが正しく動作するか

## ロールバック

問題が発生した場合は、バックアップから復元できます：

```bash
# Docker環境を停止
docker-compose down

# バックアップから復元
cp checkin.db.backup.TIMESTAMP checkin.db

# または手動バックアップから復元
cp checkin.db.manual-backup checkin.db

# 古いコードに戻す（必要に応じて）
git checkout HEAD~1

# Docker環境を起動
docker-compose up -d
```

## CSV フォーマット変更

### メンバー CSV（インポート/エクスポート）

**旧フォーマット:**

```csv
email,name,affiliation,affiliation_detail,qr_code,created_at
```

**新フォーマット:**

```csv
email,name,affiliation,affiliation_detail,member_id,created_at
```

### チェックイン CSV（インポート/エクスポート）

**旧フォーマット:**

```csv
timestamp,qr_code,affiliation,affiliation_detail
```

**新フォーマット:**

```csv
timestamp,member_id,affiliation,affiliation_detail
```

## 注意事項

- マイグレーションは不可逆的です（ロールバックにはバックアップが必要）
- 既存のメンバー ID は変更されません（qr_code の値がそのまま使用されます）
- 新規メンバー登録時は、引き続き 4 桁の英数文字が自動生成されます
- QR コードの内容は変わりません（member_id が埋め込まれます）

## トラブルシューティング

### エラー: データベースファイルが見つかりません

```bash
# DB_PATH環境変数を設定してから実行
export DB_PATH=/path/to/your/checkin.db
node scripts/migrate-qrcode-to-memberid.js
```

### エラー: マイグレーションは既に完了しています

マイグレーションは既に実行されています。追加の操作は不要です。

### エラーが発生した場合

スクリプトは自動的にロールバックします。エラーメッセージを確認して、問題を解決してから再実行してください。
