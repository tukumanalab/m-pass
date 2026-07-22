# M-Pass - QR コード入室管理システム

QR コードを使った利用者の入室管理 Web アプリケーション

## 機能

- **メンバー登録**: メンバー情報を登録してカードを発行（QR コード付き）
  - **即時利用＋メール確認機能**: 登録直後から即座にログイン・マイページ利用が可能。Gmail 経由で確認メールを非同期送信し後から認証完了するフロー（Deferred Verification）に対応
- **CSV 一括登録**: CSV ファイルでメンバーデータを一括登録・更新
- **CSV 一括ダウンロード**: 全メンバーデータを CSV 形式でエクスポート
- **カード印刷**: メンバーカードを SVG テンプレートで印刷・ダウンロード
- **QR コードスキャン**: カメラで QR コード/NFCカードをスキャンして入室・退室を自動で記録（トグル動作）
- **ダッシュボード**: 本日の入退室状況や現在の在室者数をリアルタイム表示
- **利用履歴**: 過去の入退室履歴（滞在時間付き）を確認・エクスポート
- **管理機能**: サイト設定、カードテンプレート管理、メンバー管理
- **アンケート機能**: メンバー登録時に「どこで知ったか」を収集し、管理画面でグラフ集計・CSV エクスポート

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router) + Turbopack
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **データベース**: SQLite (better-sqlite3)
- **QR コード**: qrcode (生成), html5-qrcode (スキャン)
- **認証**: bcrypt (パスワードハッシュ化)
- **メール送信**: nodemailer + Gmail API (OAuth2)
- **デプロイ**: Ubuntu Server + PM2 + Nginx

## 開発環境のセットアップ

### 必要な環境

- Node.js 20 以上
- npm
- **Docker Desktop for Mac**（Nginx 環境が必要な場合）
- **Gmail アカウント**（メール送信機能を使う場合）

### シンプルな開発（Nginx 不要）

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してGmail設定を追加（後述）

# 開発サーバーの起動（Turbopack使用）
npm run dev
```

アプリケーションは http://localhost:3000 で起動します。

### Gmail メール送信の設定（OAuth2）

メンバー登録時のメール確認機能を使用するには、Gmail API の OAuth2 認証が必要です。

> 📖 **詳細な設定手順**: [GMAIL-OAUTH2-SETUP.md](GMAIL-OAUTH2-SETUP.md) を参照してください。

#### 1. Google Cloud Console でプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成（例: "m-pass-mailer"）
3. プロジェクトを選択

#### 2. Gmail API を有効化

1. 「API とサービス」→「ライブラリ」に移動
2. "Gmail API" を検索して選択
3. 「有効にする」をクリック

#### 3. OAuth 同意画面を設定

1. 「API とサービス」→「OAuth 同意画面」に移動
2. ユーザータイプ: **外部** を選択（個人利用の場合）
3. アプリ情報を入力:
   - アプリ名: `M-Pass Mailer`
   - ユーザーサポートメール: あなたのメールアドレス
   - デベロッパーの連絡先情報: あなたのメールアドレス
4. スコープは設定不要（デフォルトで OK）
5. テストユーザーに **メール送信に使用する Gmail アドレス** を追加

#### 4. OAuth 2.0 クライアント ID を作成

1. 「API とサービス」→「認証情報」に移動
2. 「認証情報を作成」→「OAuth クライアント ID」を選択
3. アプリケーションの種類: **ウェブアプリケーション**
4. 名前: `M-Pass Web Client`
5. 承認済みのリダイレクト URI に以下を追加:
   ```
   https://developers.google.com/oauthplayground
   ```
6. 「作成」をクリック
7. **クライアント ID** と **クライアント シークレット** をコピーして保存

#### 5. リフレッシュトークンを取得

1. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) にアクセス
2. 右上の歯車アイコン（Settings）をクリック
3. 「Use your own OAuth credentials」にチェック
4. 先ほど作成した **OAuth Client ID** と **OAuth Client secret** を入力
5. 左側の「Step 1」で以下のスコープを選択:
   ```
   https://mail.google.com/
   ```
6. 「Authorize APIs」をクリック
7. Google アカウントでログイン（テストユーザーとして追加したアカウント）
8. 「このアプリは確認されていません」と表示される場合:
   - 「詳細」→「M-Pass Mailer（安全でないページ）に移動」をクリック
9. アクセスを許可
10. 「Step 2」で「Exchange authorization code for tokens」をクリック
11. **Refresh token** をコピーして保存

#### 6. 環境変数の設定

`.env` ファイルに以下を設定:

```env
# Gmail OAuth2設定
GMAIL_USER=your-email@gmail.com
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token

# アプリケーションURL（メール内のリンクで使用）
APP_URL=http://localhost:3000
```

**注意**:

- 本番環境では `APP_URL` を実際のドメインに変更してください
- OAuth2 認証情報は機密情報です。`.env` ファイルは Git にコミットしないでください

### メンバー登録フロー（即時利用＋バックグラウンドメール確認）

1. ユーザーがメンバー情報を入力して登録
2. システムが即時に本登録を行い、ログインセッションを生成してマイページへダイレクト遷移（待ち時間ゼロ）
3. システムがバックグラウンドで確認メールを送信（有効期限 24 時間）
4. メールアドレスが未確認の場合、マイページ上部に確認案内バナーおよび再送ボタンを表示
5. ユーザーがメール内の確認リンクをクリックするとメールアドレスの検証が完了

### Mac + VSCode + Nginx デバッグ環境

本番環境に近い Nginx 経由での動作確認が必要な場合：

```bash
# Docker環境セットアップ
chmod +x dev-setup.sh
./dev-setup.sh
```

詳細は [DEV-SETUP.md](DEV-SETUP.md) を参照してください。

**アクセス URL:**

- 本番環境: http://localhost:8080/members
- デバッグ環境: http://localhost:8080/members-debug

## ビルドとデプロイ

### ローカルビルド

```bash
# ビルド（Turbopack使用）
npm run build

# 本番サーバーの起動
npm start
```

### Ubuntu サーバーへのデプロイ

#### 本番環境のみ

```bash
# セットアップスクリプトを実行（初回のみ）
chmod +x deploy/setup.sh
./deploy/setup.sh
```

セットアップスクリプトは以下を自動的に実行します：

- Node.js、PM2、Nginx のインストール
- 依存関係のインストールとビルド
- PM2 でのアプリケーション起動
- Nginx の設定

本番環境は `/members` でアクセス可能です。

#### デバッグ環境（本番環境と並行稼働）

```bash
# デバッグ環境セットアップスクリプトを実行
chmod +x deploy/setup-debug.sh
./deploy/setup-debug.sh
```

デバッグ環境の特徴：

- 本番環境（`/members`）とデバッグ環境（`/members-debug`）が同時に稼働
- 本番環境とデバッグ環境は別ポート（3001）で動作
- デバッグ環境は別データベース（`members.db`）を使用
- 本番環境とデバッグ環境は完全に独立

アクセス URL：

- 本番環境: `https://tukumana.si.aoyama.ac.jp/members`
- デバッグ環境: `https://tukumana.si.aoyama.ac.jp/members-debug`

### 手動デプロイ

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# PM2で起動
pm2 start npm --name "m-pass" -- start
pm2 save

# Nginx設定
sudo cp deploy/nginx.conf /etc/nginx/sites-available/m-pass
sudo ln -s /etc/nginx/sites-available/m-pass /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## ディレクトリ構成

```
m-pass/
├── app/                      # Next.js App Router
│   ├── api/                 # API Routes
│   │   ├── members/           # メンバー登録API
│   │   ├── checkin/         # チェックインAPI
│   │   └── checkins/        # チェックイン情報取得API
│   ├── register/            # メンバー登録ページ
│   ├── scan/                # QRコードスキャンページ
│   ├── dashboard/           # ダッシュボード
│   ├── history/             # 利用履歴ページ
│   ├── layout.tsx           # レイアウト
│   ├── page.tsx             # ホームページ
│   └── globals.css          # グローバルCSS
├── lib/
│   ├── database.ts          # SQLiteデータベース操作
│   ├── auth.ts              # 認証機能
│   ├── settings.ts          # サイト設定管理
│   └── resource/            # リソースファイル
├── deploy/                   # デプロイ設定
│   ├── setup.sh             # セットアップスクリプト
│   ├── nginx.conf           # Nginx設定
│   └── pm2.config.js        # PM2設定
├── public/
│   └── uploads/             # アップロードファイル（カスタムテンプレート含む）
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## データベース

SQLite を使用し、以下の 2 つのテーブルで構成されています：

### データベースファイルの場所

#### Docker 環境（docker-compose 使用時）

データベースファイルは **Docker の名前付きボリューム内**に保存されます：

**本番環境（/member）:**

- Docker ボリューム: `m-pass_app-db-data`
- コンテナ内パス: `/app/data/members.db`
- ホスト物理パス: `/var/lib/docker/volumes/m-pass_app-db-data/_data/members.db`

**デバッグ環境（/members-debug）:**

- Docker ボリューム: `m-pass_app-debug-db-data`
- コンテナ内パス: `/app/data-debug/members.db`
- ホスト物理パス: `/var/lib/docker/volumes/m-pass_app-debug-db-data/_data/members.db`

#### ローカル開発環境（npm run dev）

- デフォルト: プロジェクトルートに `members.db` が作成される
- 環境変数 `DB_PATH` で変更可能

### データベースのバックアップと復元

#### バックアップ（Docker 環境）

```bash
# 本番環境のDBをホストにコピー
docker cp m-pass-prod:/app/data/members.db ./backup/members-$(date +%Y%m%d).db

# デバッグ環境のDBをホストにコピー
docker cp m-pass-debug:/app/data-debug/members.db ./backup/members-debug-$(date +%Y%m%d).db
```

#### 復元（Docker 環境）

```bash
# ホストのDBを本番環境にコピー
docker cp ./backup/members-20251026.db m-pass-prod:/app/data/members.db

# ホストのDBをデバッグ環境にコピー
docker cp ./backup/members-debug-20251026.db m-pass-debug:/app/data-debug/members.db

# コンテナを再起動して変更を反映
docker-compose restart app app-debug
```

#### データベースのリセット

```bash
# すべてのデータを削除してクリーンな状態に戻す
docker-compose down -v

# コンテナを再起動（空のDBが自動作成される）
docker-compose up -d
```

### データベースの初期化

#### 自動初期化（推奨）

データベースファイルが存在しない場合、**アプリケーションの最初のアクセス時に自動的に作成・初期化**されます。

```bash
# 1. コンテナを起動（DBファイルが存在しない状態でOK）
docker-compose up -d

# 2. いずれかのページにアクセスするだけで自動初期化される
# - ブラウザで http://localhost:8080/members にアクセス
# - または curl http://localhost:8080/members

# 3. データベースが作成されたか確認
docker exec m-pass-prod ls -la /app/data/
# members.db ファイルが作成されている
```

**初期化のタイミング:**

- `lib/database.ts` が最初に読み込まれた時（任意の API アクセス時）
- `members`, `checkins` テーブルが自動作成される

#### 手動での確認

````bash
**手動での確認**

```bash
# Node.jsから直接確認
docker exec m-pass-prod node -e "
const db = require('better-sqlite3')('/app/data/members.db');
console.log('Tables:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all());
console.log('Members count:', db.prepare('SELECT COUNT(*) as count FROM members').get());
db.close();
"
````

````

### members テーブル

メンバー情報を保存

| カラム名           | 型       | 説明                         |
| ------------------ | -------- | ---------------------------- |
| id                 | INTEGER  | 主キー                       |
| member_id          | TEXT     | QR コード（4 桁、ユニーク）  |
| name               | TEXT     | 氏名                         |
| affiliation        | TEXT     | 所属（必須）                 |
| affiliation_detail | TEXT     | 所属詳細（任意）             |
| email              | TEXT     | メールアドレス（必須）       |
| password_hash      | TEXT     | パスワードハッシュ（bcrypt） |
| created_at         | DATETIME | 登録日時                     |

### pending_members テーブル

メール確認待ちの仮登録メンバー情報を保存（確認後に members テーブルへ移行）

| カラム名           | 型       | 説明                            |
| ------------------ | -------- | ------------------------------- |
| id                 | INTEGER  | 主キー                          |
| token              | TEXT     | 確認トークン（64文字、ユニーク）|
| name               | TEXT     | 氏名                            |
| affiliation        | TEXT     | 所属                            |
| affiliation_detail | TEXT     | 所属詳細（任意）                |
| email              | TEXT     | メールアドレス                  |
| password_hash      | TEXT     | パスワードハッシュ（bcrypt）    |
| expires_at         | DATETIME | トークン有効期限（24時間）      |
| created_at         | DATETIME | 仮登録日時                      |

### survey_responses テーブル

登録時アンケートの回答を保存

| カラム名         | 型       | 説明                                                    |
| ---------------- | -------- | ------------------------------------------------------- |
| id               | INTEGER  | 主キー                                                  |
| member_id        | TEXT     | QR コード（4 桁）                                       |
| affiliation      | TEXT     | 所属                                                    |
| how_did_you_know | TEXT     | アンケート回答（「その他」の場合は `"その他: {自由記述}"` 形式）|
| created_at       | DATETIME | メンバー登録日時（UTC）                                 |

**注**: `members` テーブルとは独立して管理され、外部キー制約なし。

### checkins テーブル

チェックイン記録を保存

| カラム名      | 型       | 説明                    |
| ------------- | -------- | ----------------------- |
| id            | INTEGER  | 主キー                  |
| member_id     | INTEGER  | メンバー ID（外部キー） |
| check_in_time | DATETIME | チェックイン日時        |

**注**: 所属情報は`member_id`で`members`テーブルを JOIN して取得します。

## API エンドポイント

### メンバー管理

- `POST /api/members/register` - メンバー仮登録 & 確認メール送信
- `POST /api/members/verify` - メールトークン検証 & 本登録 & QR コード生成（4 桁 ID: 年+英字+数字+英字）
- `GET /api/members` - メンバー一覧取得
- `GET /api/admin/members/search` - メンバー検索
- `PUT /api/admin/members/[id]` - メンバー情報更新
- `DELETE /api/admin/members/[id]` - メンバー削除
- `POST /api/admin/members/bulk` - CSV 一括登録・更新（UPSERT）
- `GET /api/admin/members/export` - 全メンバーデータ CSV エクスポート

### チェックイン

- `POST /api/checkin` - QR コードによるチェックイン実行
- `GET /api/checkins/today` - 本日のチェックイン一覧
- `GET /api/checkins/history` - チェックイン履歴（ページネーション対応）

### アンケート

- `GET /api/admin/survey` - アンケート集計データ取得（`startDate`/`endDate` で期間フィルタ）
- `GET /api/admin/survey/export` - アンケート回答 CSV エクスポート（ファイル名: `survey_{startDate}_{endDate}.csv`）

### QR コード形式

メンバー ID は 4 桁の形式で生成されます:

- 1 桁目: 発行年の西暦の 1 桁目（一の位）
- 2 桁目: ランダムな英小文字
- 3 桁目: ランダムな数字（0-9）
- 4 桁目: ランダムな英小文字

例: `5a3b` (2025 年発行、2035 年も同じ形式)

**注**: QR コード画像はファイルとして保存されず、Base64 データ URL として生成されます。メンバーカードに埋め込まれて利用されます。

## CSV 一括登録・ダウンロード

### CSV 形式

```csv
timestamp,qr_code
2025/01/15 10:30:00,5a1b
```

| カラム名  | 必須 | 説明                         |
| --------- | ---- | ---------------------------- |
| timestamp | 必須 | チェックイン日時（下記参照） |
| qr_code   | 必須 | 4 桁の QR コード ID          |

### created_at の形式

- `YYYY/MM/DD` - 時刻なし（00:00:00 として登録）
- `YYYY/MM/DD HH:mm:ss` - 時刻あり

### 一括登録の動作

- **メンバー検索**: QR コードでメンバーを検索
- **日時登録**: 指定された日時でチェックイン記録を作成
- **所属情報**: チェックイン記録には所属を保存せず、表示時に`member_id`でメンバー情報から取得

### 失敗データの表示

- 登録に失敗したデータ（重複以外）は自動的に一覧表示
- CSV 形式でコピーして修正・再アップロード可能

### 一括ダウンロード

- 管理画面の「CSV 一括ダウンロード」ボタンから全チェックイン履歴をエクスポート
- ファイル名: `checkins_YYYY-MM-DD.csv`
- 日時は時刻付き（`YYYY/MM/DD HH:mm:ss`）で出力
- 出力内容: timestamp、qr_code、affiliation、affiliation_detail
- 所属情報は`member_id`でメンバーテーブルから自動的に取得

## アンケート機能

メンバー登録フォームに「つくまなラボをどうやって知りましたか？」というアンケートを設置し、回答を収集・集計できます。

### 設定

選択肢や質問文は `lib/survey-config.ts` で一元管理しています。このファイルのみ編集すれば、登録フォームと集計画面の両方に反映されます。

```ts
// lib/survey-config.ts
export const SURVEY_QUESTION = "つくまなラボをどうやって知りましたか？";

export const SURVEY_OPTIONS: SurveyOption[] = [
  { label: "X",         url: "https://x.com/TukumanaLab" },   // url指定でリンク表示
  { label: "Instagram", url: "https://www.instagram.com/..." },
  { label: "Web",       url: "https://sites.google.com/..." },
  { label: "学生ポータル" },
  { label: "友達から聞いた" },
  { label: "その他" },   // この選択肢を選ぶと自由記述欄が表示される
];

export const SURVEY_OTHER_OPTION = "その他"; // 自由記述を促すトリガーラベル
```

- `url` を指定すると、選択肢の横に新規タブで開くリンクが表示されます
- `SURVEY_OTHER_OPTION` と一致するラベルを選ぶと自由記述欄が表示されます

### データフロー

1. 登録フォームで回答 → `howDidYouKnow` として `POST /api/members/register` に送信
2. `pending_members.how_did_you_know` に一時保存
3. メール確認完了（`POST /api/members/verify`）時に `survey_responses` テーブルへ保存
   - 「その他」選択時は `"その他: {自由記述}"` 形式で保存
   - 未回答の場合は保存しない

### 管理画面（`/admin/survey`）

- 選択肢ごとの横棒グラフ（件数・回答率%）
- 総登録者数・回答あり件数・未回答件数のサマリ
- 開始日・終了日で期間フィルタ（JST 基準）
- CSV ダウンロード（ファイル名: `survey_{startDate}_{endDate}.csv`）

### CSV 形式

```csv
member_id,affiliation,how_did_you_know,created_at
6a1b,大学,Web,2026/04/07 10:30:00
6a2c,高等部,その他: 学校の掲示板,2026/04/07 11:00:00
```

## カードテンプレート

メンバーカードは SVG テンプレートで生成されます。

### デフォルトテンプレート

`lib/resource/card-template-default.svg`

### カスタマイズ

管理画面（`/admin/settings`）からカスタムテンプレートをアップロード可能です。

カスタムテンプレートは `public/uploads/card-template-custom.svg` として保存されます。

テンプレートの置き換え文字列:

- `NAME` → メンバー名
- `XXXX` → QR コード ID（4 桁）
- `id="QR"` 属性を持つ要素 → QR 画像

例:

```svg
<svg>
  <text>NAME</text>
  <text>ID: XXXX</text>
  <rect id="QR" x="50" y="50" width="100" height="100" />
</svg>
```

## セキュリティ

### 管理者アクセスのIP制限

管理者ページへのアクセスは、デフォルトで **組織内のネットワーク（プライベートIPアドレス範囲）からのみ** 許可されます。

詳細な設定方法については、[IP-RESTRICTION.md](IP-RESTRICTION.md) を参照してください。

#### クイック設定

`.env` ファイルに以下を追加：

```bash
# デフォルト: プライベートIPのみ許可
ADMIN_ALLOWED_IPS=private

# 特定のネットワーク範囲を許可
ADMIN_ALLOWED_IPS=192.168.1.0/24

# 複数指定（カンマ区切り）
ADMIN_ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8
```

設定後、アプリケーションを再起動してください：

```bash
pm2 restart m-pass
```

#### 管理者アクセスログの確認

本番環境で管理者アクセスのログを確認する方法：

##### 対話型ログ確認ツール（推奨）

```bash
# 対話型メニューでログを確認
chmod +x deploy/check-admin-logs.sh
./deploy/check-admin-logs.sh
```

メニューから以下を選択できます：
1. リアルタイムでログを監視
2. 管理者関連ログのみ表示
3. ログイン試行の履歴
4. 拒否されたアクセスの履歴
5. 成功したログインの履歴
6. 今日の管理者アクセス履歴
7. ログファイルの場所を表示

##### コマンドラインでの確認

```bash
# リアルタイムでログを監視
pm2 logs m-pass

# 管理者関連のログのみ表示
pm2 logs m-pass --lines 100 --nostream | grep "ADMIN"

# ログイン試行を確認
pm2 logs m-pass --lines 500 --nostream | grep "ADMIN LOGIN"

# 拒否されたアクセスを確認
pm2 logs m-pass --lines 500 --nostream | grep "DENIED"

# 成功したログインを確認
pm2 logs m-pass --lines 500 --nostream | grep "SUCCESS"

# ログファイルから直接確認
tail -f ~/.pm2/logs/m-pass-out.log | grep "ADMIN"
tail -f ~/.pm2/logs/m-pass-error.log | grep "ADMIN"
```

##### ログの例

```
2025-11-01 10:30:15 Z [ADMIN LOGIN] Attempt from IP: 192.168.1.100 (Allowed: private)
2025-11-01 10:30:15 Z [ADMIN LOGIN] ✓ LOGIN SUCCESS from IP: 192.168.1.100
2025-11-01 10:35:20 Z [ADMIN AUTH] Access attempt from IP: 192.168.1.100 (Allowed: private)
2025-11-01 10:35:20 Z [ADMIN AUTH] ✓ Access ALLOWED from IP: 192.168.1.100
2025-11-01 11:00:00 Z [ADMIN LOGIN] Attempt from IP: 203.0.113.50 (Allowed: private)
2025-11-01 11:00:00 Z [ADMIN LOGIN] ⚠️  LOGIN DENIED from unauthorized IP: 203.0.113.50
```

##### ログが表示されない場合

1. **PM2を再起動**
   ```bash
   pm2 restart m-pass
   ```

2. **ログファイルの存在確認**
   ```bash
   ls -la ~/.pm2/logs/
   ```

3. **Next.jsの出力確認**
   ```bash
   # Next.jsが正しく起動しているか確認
   pm2 info m-pass
   
   # すべてのログを確認
   pm2 logs m-pass --lines 1000
   ```

## PM2 コマンド

### 本番環境のみ稼働時

```bash
pm2 status              # ステータス確認
pm2 logs m-pass         # ログ確認
pm2 restart m-pass      # 再起動
pm2 stop m-pass         # 停止
pm2 delete m-pass       # 削除
```

### デバッグ環境も稼働時

```bash
pm2 status                      # 全アプリのステータス確認
pm2 logs m-pass                 # 本番環境ログ確認
pm2 logs m-pass-debug           # デバッグ環境ログ確認
pm2 restart m-pass              # 本番環境再起動
pm2 restart m-pass-debug        # デバッグ環境再起動
pm2 restart all                 # 全環境再起動
pm2 stop m-pass                 # 本番環境停止
pm2 stop m-pass-debug           # デバッグ環境停止
pm2 delete m-pass-debug         # デバッグ環境削除
```

## ライセンス

MIT
````
