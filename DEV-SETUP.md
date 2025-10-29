# Mac + VSCode デバッグ環境セットアップ

このガイドでは、Mac + VSCode 環境で Nginx を含むデバッグ環境を構築する方法を説明します。

## 前提条件

- **Docker Desktop for Mac**: [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Node.js 20 以上**
- **VSCode**

## セットアップ手順

### 1. 自動セットアップ（推奨）

```bash
# セットアップスクリプトを実行
chmod +x dev-setup.sh
./dev-setup.sh
```

このスクリプトは以下を自動的に実行します：

- 依存関係のインストール
- 本番環境のビルド
- デバッグ環境のビルド
- データベースマイグレーション
- Docker 環境の起動

### 2. 手動セットアップ

```bash
# 1. 依存関係のインストール
npm install

# 2. 本番環境のビルド
npm run build

# 3. デバッグ環境のビルド
npm run build:debug

# 4. Docker Composeで起動
docker-compose up -d --build
```

## アクセス URL

### Nginx 経由（本番環境に近い）

- **本番環境**: http://localhost:8080/members
- **デバッグ環境**: http://localhost:8080/members-debug

### 直接アクセス（Nginx バイパス）

- **本番環境**: http://localhost:3000
- **デバッグ環境**: http://localhost:3001

## 環境の違い

| 項目              | 本番環境               | デバッグ環境                 |
| ----------------- | ---------------------- | ---------------------------- |
| **URI**           | `/members`             | `/members-debug`             |
| **ポート**        | 3000                   | 3001                         |
| **データベース**  | `/app/data/members.db` | `/app/data-debug/members.db` |
| **DB ボリューム** | `m-pass_app-db-data`   | `m-pass_app-debug-db-data`   |
| **設定ファイル**  | `next.config.js`       | `next.config.debug.js`       |
| **コンテナ名**    | `m-pass-prod`          | `m-pass-debug`               |

### データベースの場所

Docker 環境では、データベースファイルは **Docker の名前付きボリューム内**に保存されます：

**本番環境:**

- Docker ボリューム: `m-pass_app-db-data`
- コンテナ内パス: `/app/data/members.db`
- ホスト物理パス: `/var/lib/docker/volumes/m-pass_app-db-data/_data/members.db`

**デバッグ環境:**

- Docker ボリューム: `m-pass_app-debug-db-data`
- コンテナ内パス: `/app/data-debug/members.db`
- ホスト物理パス: `/var/lib/docker/volumes/m-pass_app-debug-db-data/_data/members.db`

### データベースのバックアップと復元

```bash
# バックアップ（コンテナからホストへコピー）
mkdir -p backup
docker cp m-pass-prod:/app/data/members.db ./backup/members-$(date +%Y%m%d-%H%M%S).db
docker cp m-pass-debug:/app/data-debug/members.db ./backup/members-debug-$(date +%Y%m%d-%H%M%S).db

# 復元（ホストからコンテナへコピー）
docker cp ./backup/members-20251026-103000.db m-pass-prod:/app/data/members.db
docker cp ./backup/members-debug-20251026-103000.db m-pass-debug:/app/data-debug/members.db
docker-compose restart app app-debug

# データベースのリセット（全データ削除）
docker-compose down -v
docker-compose up -d
```

## Docker コマンド

### ログ確認

```bash
# 全サービスのログ
docker-compose logs -f

# 本番環境のみ
docker-compose logs -f app

# デバッグ環境のみ
docker-compose logs -f app-debug

# Nginxのみ
docker-compose logs -f nginx
```

### サービス管理

```bash
# 全サービス起動
docker-compose up -d

# 全サービス停止・削除
docker-compose down

# 本番環境再起動
docker-compose restart app

# デバッグ環境再起動
docker-compose restart app-debug

# Nginx再起動
docker-compose restart nginx

# 全サービス再ビルド
docker-compose up -d --build
```

### コンテナ内に入る

```bash
# 本番環境
docker exec -it m-pass-prod sh

# デバッグ環境
docker exec -it m-pass-debug sh

# Nginx
docker exec -it m-pass-nginx sh
```

## VSCode デバッグ機能

VSCode のデバッグパネル（F5）から以下の設定を選択できます：

### Docker 未使用（ローカル直接起動）

1. **Next.js: 本番環境 (server-side)** - ポート 3000 でサーバーサイドデバッグ
2. **Next.js: デバッグ環境 (server-side)** - ポート 3001 でサーバーサイドデバッグ
3. **Next.js: 本番環境 (client-side)** - ブラウザでクライアントサイドデバッグ
4. **Next.js: デバッグ環境 (client-side)** - ブラウザでクライアントサイドデバッグ
5. **Next.js: 本番環境 (full stack)** - フルスタックデバッグ
6. **Next.js: デバッグ環境 (full stack)** - フルスタックデバッグ

### Docker 使用時

7. **Docker: Nginx 経由で本番環境** - http://localhost:8080/members をブラウザで開く
8. **Docker: Nginx 経由でデバッグ環境** - http://localhost:8080/members-debug をブラウザで開く

## npm スクリプト

```bash
# 開発サーバー（本番環境、ポート3000）
npm run dev

# 開発サーバー（デバッグ環境、ポート3001）
npm run dev:debug

# ビルド（本番環境）
npm run build

# ビルド（デバッグ環境）
npm run build:debug

# 本番サーバー起動（本番環境、ポート3000）
npm start

# 本番サーバー起動（デバッグ環境、ポート3001）
npm run start:debug
```

## トラブルシューティング

### ポートが既に使用されている

```bash
# 使用中のポートを確認
lsof -i :3000
lsof -i :3001
lsof -i :8080

# プロセスを停止
kill -9 <PID>
```

### Docker コンテナが起動しない

```bash
# コンテナとボリュームを完全削除して再構築
docker-compose down -v
docker-compose up -d --build
```

### データベースエラー

```bash
# データベースファイルの確認（Docker環境）
docker exec m-pass-prod ls -lah /app/data/
docker exec m-pass-debug ls -lah /app/data-debug/

# データベースをリセット（全データ削除）
docker-compose down -v
docker-compose up -d

# 既存のデータベースをバックアップしてからリセット
mkdir -p backup
docker cp m-pass-debug:/app/data-debug/members.db ./backup/members-debug-backup.db
docker-compose down -v
docker-compose up -d
```

### Nginx 設定エラー

```bash
# Nginx設定をテスト
docker exec m-pass-nginx nginx -t

# Nginxを再起動
docker-compose restart nginx
```

## 開発ワークフロー

### パターン 1: Docker 使用（本番に近い環境）

1. `./dev-setup.sh` で Docker 環境起動
2. http://localhost:8080/members-debug でアクセス
3. コード変更時は `docker-compose restart app-debug` で反映

### パターン 2: ローカル開発（高速）

1. `npm run dev:debug` でデバッグサーバー起動
2. http://localhost:3001 でアクセス
3. コード変更は自動的にホットリロード

### パターン 3: 両環境同時テスト

1. ターミナル 1: `npm run dev` （本番環境）
2. ターミナル 2: `npm run dev:debug` （デバッグ環境）
3. ブラウザで両方のポートを開いて比較テスト

## 本番デプロイ前のチェック

デバッグ環境でテストが完了したら、本番環境でも動作確認：

```bash
# Docker環境で本番URIをテスト
docker-compose up -d
open http://localhost:8080/members

# または、ローカルで本番環境をテスト
npm run build
npm start
open http://localhost:3000
```

## 関連ファイル

- [docker-compose.yml](docker-compose.yml) - Docker Compose 設定
- [Dockerfile.dev](Dockerfile.dev) - 開発用 Dockerfile
- [deploy/nginx-local.conf](deploy/nginx-local.conf) - ローカル Nginx 設定
- [.vscode/launch.json](.vscode/launch.json) - VSCode デバッグ設定
- [next.config.js](next.config.js) - 本番環境 Next.js 設定
- [next.config.debug.js](next.config.debug.js) - デバッグ環境 Next.js 設定
