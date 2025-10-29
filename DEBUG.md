# デバッグ手順ガイド

VSCode でブレークポイントを使ったデバッグ手順を説明します。

## 目次

1. [クイックスタート](#クイックスタート)
2. [パターン 1: ローカル開発サーバーでデバッグ（最も簡単・推奨）](#パターン1-ローカル開発サーバーでデバッグ最も簡単推奨)
3. [パターン 2: Docker + Nginx でデバッグ](#パターン2-docker--nginx-でデバッグ)
4. [パターン 3: ログでデバッグ](#パターン3-ログでデバッグ)
5. [利用可能なデバッグ設定](#利用可能なデバッグ設定)
6. [Docker 環境の管理](#docker環境の管理)
7. [よくある質問](#よくある質問)
8. [デバッグのベストプラクティス](#デバッグのベストプラクティス)
9. [トラブルシューティング](#トラブルシューティング)

---

## クイックスタート

### 最も簡単な方法（ローカル）

```bash
# ステップ1: デバッグサーバー起動
npm run dev:debug
```

```
ステップ2: VSCodeでブレークポイント設定
  1. app/api/members/route.ts を開く
  2. 10行目の左側をクリック（赤い丸●が表示）

ステップ3: F5キーを押す
  → 「🟢 デバッグ環境 (ローカル・推奨)」を選択

ステップ4: ブラウザで http://localhost:3001/register を開く
  → メンバー登録を実行
  → VSCodeでブレークポイントで停止！
```

### Docker + Nginx 環境

```bash
# ステップ1: Docker起動
docker-compose up -d

# ステップ2: デバッグポート確認
docker-compose logs app-debug | grep "Debugger listening"
```

```
ステップ3: VSCodeでブレークポイント設定
  1. app/api/members/route.ts の10行目に●

ステップ4: F5キーを押す
  → 「🐳 デバッグ環境 (Docker Attach)」を選択

ステップ5: ブラウザで http://localhost:8080/members-debug/register
  → メンバー登録を実行
  → VSCodeでブレークポイントで停止！
```

---

## パターン 1: ローカル開発サーバーでデバッグ（最も簡単・推奨）

### ステップ 1: ブレークポイントを設定

1. VSCode でデバッグしたいファイルを開く
   - 例: `app/api/members/route.ts`
2. 停止したい行番号の**左側の余白**をクリック
3. 赤い丸 ● が表示されれば OK

**おすすめのデバッグポイント:**

```typescript
// app/api/members/route.ts の10行目
const yearDigit = currentYear % 10; // ← ここに●

// app/layout.tsx の22行目
const settings = loadSettings(); // ← ここに●
```

### ステップ 2: デバッグを開始

**方法 A: キーボードショートカット（推奨）**

1. `F5` キーを押す
2. 初回は設定選択画面が表示される → **「🟢 デバッグ環境 (ローカル・推奨)」** を選択

**方法 B: メニューから**

1. VSCode 左サイドバーの「実行とデバッグ」アイコン（虫マーク 🐛）をクリック
2. ドロップダウンから **「🟢 デバッグ環境 (ローカル・推奨)」** を選択
3. 緑の ▶ ボタンをクリック

### ステップ 3: デバッガーが起動

- ターミナルに `✓ Ready in XX ms` が表示される
- 自動的にブラウザが開くか、手動で http://localhost:3001 を開く

### ステップ 4: ブレークポイントで停止

1. ブラウザでページをリロード（`Cmd+R` または `F5`）
2. VSCode に自動的に切り替わり、ブレークポイントで実行が停止
3. 黄色のハイライト行が表示される

### ステップ 5: デバッグ操作

VSCode 上部のデバッグツールバーで操作:

| アイコン | 操作      | ショートカット | 説明                         |
| -------- | --------- | -------------- | ---------------------------- |
| ▶        | Continue  | `F5`           | 次のブレークポイントまで実行 |
| ⤵        | Step Over | `F10`          | 現在の行を実行して次の行へ   |
| ⤴        | Step Into | `F11`          | 関数の中に入る               |
| ⤴        | Step Out  | `Shift+F11`    | 関数から抜ける               |
| ⟲        | Restart   | `Cmd+Shift+F5` | デバッグ再起動               |
| ■        | Stop      | `Shift+F5`     | デバッグ停止                 |

**変数の確認:**

- 左サイドバーの「変数」パネルで値を確認
- コード上で変数にマウスホバーでも値を表示
- デバッグコンソールで式を評価可能（例: `settings.title`）

---

## パターン 2: Docker + Nginx でデバッグ

本番環境に近い構成（Nginx 経由）でデバッグする方法。

### ステップ 1: Docker 環境を起動

```bash
# Docker環境起動
docker-compose up -d --build

# ログでデバッグポートが開いているか確認
docker-compose logs app-debug | grep "Debugger listening"
# → "Debugger listening on ws://0.0.0.0:9229/..." が表示されればOK
```

### ステップ 2: ブレークポイントを設定

ローカルと同じ手順でブレークポイントを設定

```typescript
// app/api/members/route.ts の10行目
const yearDigit = currentYear % 10; // ← ここに●
```

### ステップ 3: デバッガーをアタッチ

1. VSCode の「実行とデバッグ」パネルを開く（虫マーク 🐛）
2. **「🐳 デバッグ環境 (Docker Attach)」** を選択
3. 緑の ▶ ボタンをクリック（または `F5`）

VSCode 下部に「デバッガーがアタッチされました」のメッセージが表示されます。

### ステップ 4: ブラウザでアクセス

以下のいずれかでアクセス:

**A. Nginx 経由（本番環境に近い）**

```
http://localhost:8080/members-debug
http://localhost:8080/members-debug/register
```

- basePath 付きの URL でアクセス
- 本番環境と同じパス構造

**B. 直接アクセス（開発用）**

```
http://localhost:3001
http://localhost:3001/register
```

- basePath 無しで直接アクセス
- 起動・リロードが高速

### ステップ 5: デバッグ操作

1. ブラウザでメンバー登録フォームに入力
2. 「登録」ボタンをクリック
3. **VSCode に自動的に切り替わり、ブレークポイントで停止**
4. 変数の値を確認、ステップ実行が可能

### アクセス URL 一覧

| 環境         | アクセス方法 | URL                                 |
| ------------ | ------------ | ----------------------------------- |
| 本番環境     | 直接         | http://localhost:3000               |
| 本番環境     | Nginx 経由   | http://localhost:8080/members       |
| デバッグ環境 | 直接         | http://localhost:3001               |
| デバッグ環境 | Nginx 経由   | http://localhost:8080/members-debug |

---

## パターン 3: ログでデバッグ

ブレークポイントを使わず、ログで確認する方法。

### ローカル環境

```typescript
// コードに console.log を追加
const yearDigit = currentYear % 10;
console.log("🔍 DEBUG: yearDigit =", yearDigit);
console.log("🔍 DEBUG: qrCode =", qrCode);
```

```bash
# ターミナルでログを確認
npm run dev:debug
# → ターミナルにログが表示される
```

### Docker 環境

```typescript
// コードに console.log を追加（同じ）
console.log("🔍 DEBUG: yearDigit =", yearDigit);
```

```bash
# リアルタイムでログを表示
docker-compose logs -f app-debug

# 特定のキーワードで検索
docker-compose logs app-debug | grep "🔍 DEBUG"

# 最新100行を表示
docker-compose logs --tail=100 app-debug
```

**メリット:**

- ブレークポイントより簡単
- 複数の値を一度に確認できる
- 実行フローを止めない

**デメリット:**

- ステップ実行できない
- 変数の詳細な確認が難しい

---

## 利用可能なデバッグ設定

VSCode の「実行とデバッグ」パネルで選択可能:

| 名前                             | 説明                               | 環境     | 用途                                     |
| -------------------------------- | ---------------------------------- | -------- | ---------------------------------------- |
| 🟢 デバッグ環境 (ローカル・推奨) | ローカルでデバッグ環境を起動       | ローカル | **サーバーサイドデバッグ（最も簡単）**   |
| 🔵 本番環境 (ローカル)           | ローカルで本番環境を起動           | ローカル | 本番環境のサーバーサイドデバッグ         |
| 🐳 デバッグ環境 (Docker Attach)  | Docker コンテナにアタッチ          | Docker   | **Docker 環境のサーバーサイドデバッグ**  |
| 🌐 デバッグ環境 (ブラウザ)       | ブラウザを開く                     | ローカル | クライアントサイドデバッグ               |
| 🌐 Docker + Nginx (デバッグ環境) | Nginx 経由でブラウザを開く         | Docker   | Nginx 経由でのクライアントサイドデバッグ |
| 🟡 フルスタック (デバッグ環境)   | サーバー起動＋ブラウザ自動オープン | ローカル | サーバー・クライアント両方デバッグ       |

---

## Docker 環境の管理

### データベース管理

#### データベースファイルの場所

Docker 環境では、データベースファイルは **名前付きボリューム内**に保存されます：

**本番環境:**

```bash
# ボリューム: m-pass_app-db-data
# コンテナ内パス: /app/data/members.db

# データベースファイルの確認
docker exec m-pass-prod ls -lah /app/data/
```

**デバッグ環境:**

```bash
# ボリューム: m-pass_app-debug-db-data
# コンテナ内パス: /app/data-debug/members.db

# データベースファイルの確認
docker exec m-pass-debug ls -lah /app/data-debug/
```

#### データベースのバックアップ

```bash
# バックアップディレクトリを作成
mkdir -p backup

# 本番環境のDBをバックアップ
docker cp m-pass-prod:/app/data/members.db ./backup/members-$(date +%Y%m%d-%H%M%S).db

# デバッグ環境のDBをバックアップ
docker cp m-pass-debug:/app/data-debug/members.db ./backup/members-debug-$(date +%Y%m%d-%H%M%S).db

# バックアップの確認
ls -lh backup/
```

#### データベースの復元

```bash
# 本番環境に復元
docker cp ./backup/members-20251026-103000.db m-pass-prod:/app/data/members.db
docker-compose restart app

# デバッグ環境に復元
docker cp ./backup/members-debug-20251026-103000.db m-pass-debug:/app/data-debug/members.db
docker-compose restart app-debug
```

#### データベースのリセット（全データ削除）

```bash
# すべてのデータを削除してクリーンな状態に戻す
docker-compose down -v

# コンテナを再起動（空のDBが自動作成される）
docker-compose up -d
```

#### データベースの初期化

データベースは、アプリケーションの初回起動時に自動的に作成・初期化されます。

**自動初期化の仕組み:**

`lib/database.ts` がインポートされた時点で、以下のテーブルが自動作成されます：

- `members` - メンバー情報テーブル
- `checkins` - チェックイン記録テーブル

**手動で初期化を確認する方法:**

```bash
# 方法1: アプリケーションを起動（自動的にDBが作成される）
docker-compose up -d

# APIエンドポイントにアクセスしてDBを初期化
curl http://localhost:3001/api/members
# または
curl http://localhost:8080/members-debug/api/members

# 方法2: Node.jsスクリプトでテーブル作成を確認
docker exec m-pass-debug node -e "const db = require('better-sqlite3')('/app/data-debug/members-debug.db'); console.log('Tables:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all()); db.close();"

# 結果例:
# Tables: [
#   { name: 'members' },
#   { name: 'checkins' },
#   { name: 'sqlite_sequence' }
# ]
```

**完全に再初期化する場合:**

```bash
# ステップ1: すべてのデータを削除
docker-compose down -v

# ステップ2: コンテナを再起動（新しい空のDBが作成される）
docker-compose up -d

# ステップ3: ブラウザまたはcurlでアクセス（テーブルが自動作成される）
curl http://localhost:8080/members-debug/api/members

# ステップ4: 初期化を確認
docker exec m-pass-debug node -e "const db = require('better-sqlite3')('/app/data-debug/members-debug.db'); console.log('Tables:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all()); db.close();"
```

**ローカル開発環境の場合:**

```bash
# データベースファイルを削除
rm -f members.db members-debug.db

# 開発サーバーを起動（DBが自動作成される）
npm run dev:debug

# ブラウザで http://localhost:3001 にアクセス
# → データベースが自動的に初期化される
```

#### データベースの直接操作

**方法 2: Node.js スクリプトで確認（推奨）**

```bash
# メンバー数を確認
docker exec m-pass-debug node -e "const db = require('better-sqlite3')('/app/data-debug/members.db'); console.log('Members:', db.prepare('SELECT COUNT(*) as count FROM members').get()); db.close();"

# テーブル一覧を確認
docker exec m-pass-debug node -e "const db = require('better-sqlite3')('/app/data-debug/members.db'); console.log('Tables:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all()); db.close();"

# 全メンバーを表示
docker exec m-pass-debug node -e "const db = require('better-sqlite3')('/app/data-debug/members.db'); console.log('Members:', JSON.stringify(db.prepare('SELECT * FROM members LIMIT 5').all(), null, 2)); db.close();"
```

**方法 2: データベースファイルをホストにコピーして SQLite3 で確認**

```bash
# データベースをホストにコピー
docker cp m-pass-debug:/app/data-debug/members.db ./temp-db.db

# ホストのSQLite3で確認（SQLite3がインストールされている場合）
sqlite3 ./temp-db.db "SELECT COUNT(*) FROM members;"
sqlite3 ./temp-db.db ".tables"
sqlite3 ./temp-db.db ".schema members"

# 確認後、一時ファイルを削除
rm ./temp-db.db
```

**方法 3: コンテナ内に SQLite3 をインストール（一時的）**

```bash
# コンテナ内にSQLite3をインストール
docker exec m-pass-debug apk add --no-cache sqlite

# SQLiteコマンドで確認
docker exec m-pass-debug sh -c "echo 'SELECT COUNT(*) FROM members;' | sqlite3 /app/data-debug/members.db"

# テーブル一覧を表示
docker exec m-pass-debug sh -c "echo '.tables' | sqlite3 /app/data-debug/members.db"

# スキーマを表示
docker exec m-pass-debug sh -c "echo '.schema members' | sqlite3 /app/data-debug/members.db"

# 注意: コンテナ再起動後はインストールが消えます
```

**方法 4: VSCode 拡張機能で GUI で確認**

```bash
# 1. データベースをホストにコピー
docker cp m-pass-debug:/app/data-debug/members.db ./members-debug.db

# 2. VSCodeで「SQLite Viewer」拡張機能をインストール
# 3. VSCodeでmembers-debug.dbファイルを開く
# 4. GUIでテーブルやデータを確認
```

### ログ確認

```bash
# 全コンテナのログ
docker-compose logs -f

# デバッグ環境のみ
docker-compose logs -f app-debug

# 本番環境のみ
docker-compose logs -f app

# Nginxのみ
docker-compose logs -f nginx

# 最新100行を表示
docker-compose logs --tail=100 app-debug

# キーワード検索
docker-compose logs app-debug | grep "ERROR"
```

### コンテナ管理

```bash
# ステータス確認
docker-compose ps

# コンテナ再起動
docker-compose restart app-debug

# 全コンテナ再起動
docker-compose restart

# コンテナ停止
docker-compose stop

# コンテナ停止＋削除
docker-compose down

# ボリュームも含めて完全削除
docker-compose down -v
```

### 再ビルド

```bash
# 全コンテナ再ビルド
docker-compose up -d --build

# デバッグ環境のみ再ビルド
docker-compose up -d --build app-debug

# キャッシュを使わずに完全再ビルド
docker-compose build --no-cache app-debug
docker-compose up -d app-debug
```

### コンテナ内で作業

```bash
# デバッグ環境コンテナに入る
docker exec -it m-pass-debug sh

# 中でコマンド実行
ls -la
cat package.json
npm run --help

# データベース確認
ls -la *.db
# → members-debug.db が存在するか確認

# コンテナから抜ける
exit
```

---

## よくある質問

### Q1: ブレークポイントが無効（グレーの丸）になる

**原因:** ソースマップが見つからない、またはコードが実行されていない

**解決策:**

1. デバッグサーバーを再起動

   ```bash
   # ローカル: Ctrl+C で停止後
   npm run dev:debug

   # Docker:
   docker-compose restart app-debug
   ```

2. ブラウザでページをリロード
3. TypeScript Server を再起動: `Cmd+Shift+P` → 「TypeScript: Restart TS Server」

### Q2: ブレークポイントで停止しない

**原因:** コードが実行されるパスにブレークポイントがない

**解決策:**

1. ブレークポイントを設定した関数が本当に実行されているか確認
   ```typescript
   console.log("🔍 この関数は実行されている？");
   ```
2. クライアントコンポーネント（`'use client'`）の場合はブラウザデバッグツール（F12）を使用
3. サーバーサイドコードの場合はターミナルにエラーがないか確認

### Q3: 変数の値が `<unavailable>` と表示される

**原因:** スコープ外、または最適化により削除された

**解決策:**

1. 変数が使用される行にブレークポイントを設定
2. `console.log()` で値を出力して確認
   ```typescript
   console.log("🔍 DEBUG:", { yearDigit, qrCode, memberId });
   ```

### Q4: ポート 3001 が既に使用されている

**原因:** 前のデバッグセッションが終了していない

**解決策:**

```bash
# プロセスを確認
lsof -i :3001

# プロセスを強制終了
kill -9 <PID>

# または、全てのNode.jsプロセスを停止
killall node

# Dockerの場合
docker-compose down
```

### Q5: Docker デバッグでアタッチできない

**原因:** デバッグポートが開いていない

**解決策:**

```bash
# コンテナを再起動
docker-compose restart app-debug

# ログでデバッグポートを確認
docker-compose logs app-debug | grep "Debugger"
# → "Debugger listening on ws://0.0.0.0:9229/..." が表示されるべき

# ポートが開いているか確認
lsof -i :9230
# → OrbStack または docker-proxy が表示されるべき
```

### Q6: コード変更が反映されない（Docker）

**原因:** ボリュームマウントの問題、またはビルドキャッシュ

**解決策:**

```bash
# コンテナを再起動
docker-compose restart app-debug

# または完全再ビルド
docker-compose down
docker-compose up -d --build

# キャッシュを使わずに再ビルド
docker-compose build --no-cache
docker-compose up -d
```

### Q7: Nginx 経由でアクセスできない

**原因:** Nginx 設定またはコンテナ間通信の問題

**解決策:**

```bash
# Nginx設定をテスト
docker exec m-pass-nginx nginx -t

# Nginxログを確認
docker-compose logs nginx

# Nginxを再起動
docker-compose restart nginx

# 直接アクセスで動作するか確認
curl http://localhost:3001
# → 動作すればNginxの問題
```

### Q9: Docker 環境で "Module not found" エラー（ローカルでは動作）

**原因:** Docker 環境の`node_modules`が古く、最新の依存関係がインストールされていない

**症状:**

- ローカル環境では正常に動作
- Docker 環境でのみ `Module not found: Can't resolve 'react-toastify'` などのエラー
- `package.json`に依存関係は存在している

**解決策:**

```bash
# 方法1: コンテナを完全再ビルド（推奨）
docker-compose down
docker-compose build --no-cache app-debug
docker-compose up -d app-debug

# 方法2: コンテナ内で依存関係を再インストール
docker exec m-pass-debug npm ci

# 方法3: コンテナを再起動（docker-entrypoint.shが依存関係をチェック）
docker-compose restart app-debug

# パッケージがインストールされたか確認
docker exec m-pass-debug npm list <パッケージ名>
# 例: docker exec m-pass-debug npm list react-toastify
```

**恒久的な解決策:**

`docker-entrypoint.sh`で起動時に依存関係をチェックするように設定済み：

```bash
# 依存関係が最新かチェック（package.jsonが変更されている場合はインストール）
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo "Installing/updating dependencies..."
  npm ci
fi
```

この設定により、`package.json`が更新された場合、コンテナ起動時に自動的に依存関係がインストールされます。

### Q8: ブレークポイントが設定できない（赤い丸が表示されない）

**原因:** VSCode の設定または TypeScript Server の問題

**解決策:**

1. TypeScript Server を再起動
   - `Cmd+Shift+P` → 「TypeScript: Restart TS Server」
2. VSCode を再起動
3. JavaScript Debugger 拡張機能が有効か確認
   - 左サイドバーの「拡張機能」→「JavaScript Debugger」を確認

---

## デバッグのベストプラクティス

### 1. サーバーサイドとクライアントサイドの違いを理解する

| コード種別         | 実行場所 | デバッグ方法          | 例                                              |
| ------------------ | -------- | --------------------- | ----------------------------------------------- |
| サーバーサイド     | Node.js  | VSCode デバッガー     | API Routes, Server Components, データベース処理 |
| クライアントサイド | ブラウザ | Chrome DevTools (F12) | `'use client'` コンポーネント, ブラウザイベント |

### 2. まずは `console.log()` で確認

ブレークポイントの前に、まず `console.log()` でコードが実行されているか確認するのが効率的。

```typescript
console.log("🔍 DEBUG: settings =", settings);
console.log("🔍 DEBUG: yearDigit =", yearDigit);
console.log("🔍 DEBUG: 全変数 =", { yearDigit, qrCode, memberId });
```

### 3. 条件付きブレークポイント

ブレークポイントを右クリック → 「条件付きブレークポイントの編集」で、特定の条件でのみ停止可能。

**例: 特定のメンバー ID のみ停止**

```
memberId === 123
```

**例: 特定の値の場合のみ停止**

```
qrCode.startsWith('5')
```

### 4. ログポイント

ブレークポイントを右クリック → 「ログポイント」で、停止せずにログ出力のみ可能。

**例:**

```
settings.title = {settings.title}
```

実行を止めずにログだけ出力されるので、ループ処理のデバッグに便利。

### 5. デバッグ環境の使い分け

| 状況               | 推奨環境       | 理由                             |
| ------------------ | -------------- | -------------------------------- |
| 通常の開発         | ローカル       | 起動が速い、ホットリロードが高速 |
| Nginx 動作確認     | Docker         | 本番環境に近い構成               |
| basePath 動作確認  | Docker + Nginx | `/members-debug` でアクセス可能  |
| データベーステスト | どちらでも     | DB_PATH 環境変数で切り替え可能   |

### 6. API Route でテストする

Server Component よりも、API Route の方がブレークポイントが設定しやすく、動作確認も簡単です。

**おすすめのテストファイル:**

- `app/api/members/route.ts` - メンバー登録 API
- `app/api/checkin/route.ts` - チェックイン API

---

## トラブルシューティング

### 基本的な対処法

問題が解決しない場合、以下を順番に試してください：

#### 1. デバッグサーバーを再起動

**ローカル:**

```bash
# Ctrl+C で停止後
npm run dev:debug
```

**Docker:**

```bash
docker-compose restart app-debug
```

#### 2. VSCode を再起動

1. `Cmd+Q` で VSCode を完全終了
2. VSCode を再起動
3. デバッグを再実行

#### 3. node_modules とビルドキャッシュをクリア

```bash
# node_modulesと.nextを削除
rm -rf node_modules .next

# 依存関係を再インストール
npm install

# デバッグ環境をビルド
npm run build:debug
```

#### 4. Docker を完全再構築

```bash
# コンテナとボリュームを完全削除
docker-compose down -v

# イメージも削除
docker rmi m-pass-app-debug m-pass-app

# 完全再ビルド
docker-compose up -d --build
```

### 環境別のトラブルシューティング

#### ローカル環境

```bash
# プロセス確認
ps aux | grep node

# ポート確認
lsof -i :3001

# 全Node.jsプロセスを停止
killall node

# 再起動
npm run dev:debug
```

#### Docker 環境

```bash
# コンテナステータス確認
docker-compose ps

# ログ確認
docker-compose logs app-debug

# デバッグポート確認
docker-compose logs app-debug | grep "Debugger listening"

# コンテナ再起動
docker-compose restart app-debug

# 完全再ビルド
docker-compose down
docker-compose up -d --build
```
