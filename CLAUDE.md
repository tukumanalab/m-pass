# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository: m-pass

QR コードを使ったメンバーの入室管理 Web アプリケーション

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router) + Turbopack
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **データベース**: SQLite (better-sqlite3)
- **QR コード**: qrcode (生成), html5-qrcode (スキャン)
- **デプロイ**: Ubuntu Server + PM2 + Nginx

## 環境変数

- **BASE_PATH**: デプロイパス（例: `/members`, `/members-debug`）

  - Next.js の`basePath`として使用される
  - リソースファイル（画像、音声）のパスは `<BASE_PATH>/uploads/*` となる
  - 本番環境: `/members`
  - デバッグ環境: `/members-debug`
  - デプロイ時に PM2 や docker-compose で指定可能

- **DB_PATH**: データベースファイルのパス（オプション）
  - 明示的に指定しない場合、デフォルトで `members.db` が使用される
  - 手動指定する場合の例: `./members.db`, `./data/production.db`

## コマンド

### 開発

```bash
npm install          # 依存関係のインストール
npm run dev          # 開発サーバー起動（Turbopack使用）
npm run build        # 本番ビルド（Turbopack使用）
npm start            # 本番サーバー起動（Turbopack使用）
npm run lint         # ESLint実行
```

### デプロイ（Ubuntu Server）

```bash
chmod +x deploy/setup.sh
./deploy/setup.sh    # 自動セットアップ（初回）

# PM2コマンド
pm2 status           # ステータス確認
pm2 logs m-pass      # ログ確認
pm2 restart m-pass   # 再起動
```

## アーキテクチャ

### データフロー

1. **メンバー登録**: フォーム入力（アンケート含む） → API → DB 登録 → QR コード生成（Base64 データ URL） → カード生成・表示
2. **チェックイン**: カメラで QR スキャン → API → QR コード検証 → DB 記録 → 完了画面表示

### データベース構造

**members テーブル**: メンバーマスタデータ

- QR コードでユニーク制約（4 桁形式）
- 所属情報（affiliation/affiliation_detail）を保存
- パスワードハッシュ（bcrypt、saltRounds=10）を保存
- 登録時に 4 桁の ID 生成（年+英字+数字+英字）

**checkins テーブル**: チェックイン・チェックアウト記録

- member_id でメンバーと紐付け
- check_in_time, check_out_time で在館・滞在時間管理

**survey_responses テーブル**: アンケート回答

- member_id（4 桁 ID）と affiliation（所属）を保存
- how_did_you_know にアンケート回答を保存（「その他」の場合は `"その他: {自由記述}"` 形式）
- created_at はメンバー登録時刻（UTC）を使用
- members テーブルとは独立（外部キー制約なし）

### API 設計

全ての API は `/app/api/` 配下に配置された Next.js Route Handlers

**メンバー管理 API:**

- `GET /api/members` - 全メンバー一覧取得
- `POST /api/members` - メンバー登録 & QR コード生成（4 桁 ID: 年+英字+数字+英字、bcrypt でパスワードハッシュ化）
- `GET /api/admin/members/search` - メンバー検索（名前、所属、メール、QR コード）
- `PUT /api/admin/members/[id]` - メンバー情報更新
- `DELETE /api/admin/members/[id]` - メンバー削除（チェックイン履歴も削除）
- `POST /api/admin/members/bulk` - CSV 一括登録・更新（UPSERT、重複は上書き）
- `GET /api/admin/members/export` - 全メンバーデータ CSV エクスポート

**チェックイン・チェックアウト API:**

- `POST /api/checkin` - QR コード/NFCカードでチェックイン・チェックアウトの自動切り替え（トグル）実行
- `GET /api/checkins/today` - 本日の入退室一覧（SQLite で日付フィルタ）
- `GET /api/checkins/history` - 履歴取得（limit/offset でページネーション、退室時刻・滞在時間付き）

**アンケート API:**

- `GET /api/admin/survey` - アンケート集計データ取得（`startDate`/`endDate` クエリパラメータで期間フィルタ）
- `GET /api/admin/survey/export` - アンケート回答 CSV エクスポート（`startDate`/`endDate` で期間フィルタ、ファイル名に期間が入る）

### フロントエンド構成

**公開ページ:**

- `/` - ホーム（4 つの主要機能へのリンク）
- `/register` - メンバー登録フォーム（Client Component、アンケート含む）
- `/scan` - QR コードスキャン（html5-qrcode、カメラ使用）
- `/dashboard` - 本日のチェックイン表示（30 秒自動更新）
- `/history` - 過去の利用履歴

**管理画面:**

- `/admin/login` - 管理者ログイン
- `/admin/dashboard` - 管理ダッシュボード
- `/admin/members` - メンバー管理（検索、編集、削除、CSV 一括登録・ダウンロード）
- `/admin/settings` - サイト設定、カードテンプレート管理
- `/admin/survey` - アンケート集計（棒グラフ表示、期間フィルタ、CSV ダウンロード）

## 重要な実装ポイント

### データベース初期化

- `lib/database.ts`のインポート時に自動的にテーブル作成
- better-sqlite3 は同期的に動作するため、API Routes で await 不要

### QR コード生成（4 桁 ID 形式）

- **形式**: `年の一の位(1桁) + 英小文字(1桁) + 数字(1桁) + 英小文字(1桁)`
- **例**: `5a3b` (2025 年発行、西暦の一の位が 5)
- 重複チェック機能付き（最大 100 回再試行）
- `qrcode`パッケージで Base64 データ URL として生成（ファイルには保存しない）
- QR 画像はメンバーカードに埋め込まれて使用される

### パスワード管理

- bcrypt でハッシュ化（saltRounds=10）
- パスワード強度チェック（英数記号を含む 8 文字以上）
- 正規表現: `/^[A-Za-z\d@$!%*?&_.\-+]{8,}$/` （+記号も許可）

### QR コードスキャン

- html5-qrcode でブラウザのカメラを使用
- `facingMode: 'environment'`で背面カメラ優先
- スキャン成功時にカメラ停止してから API 呼び出し

### Webpack 設定

- `next.config.js`で better-sqlite3 を externals 指定
- サーバーサイドのみでの使用を明示

### Turbopack 設定

- package.json で`--turbopack`フラグを指定
- dev、build、start の全てで Turbopack 使用

## デプロイ構成

### PM2

- Next.js をプロセス管理
- ポート 3000 で起動
- 自動再起動・ログ管理

### Nginx

- リバースプロキシとしてポート 80 でリクエスト受付
- 全てのリクエストを Next.js にプロキシ

## 開発時の注意点

- better-sqlite3 はサーバーサイドのみで使用（Client Component でインポート禁止）
- bcrypt もサーバーサイドのみで使用
- html5-qrcode はクライアントサイドのみで動作
- QR コード ID は 4 桁形式で生成され、年+英字+数字+英字の組み合わせ（最大 6,760 通り/年）

### データベースファイルの場所

#### Docker 環境（docker-compose 使用時）

データベースファイルは **Docker の名前付きボリューム内**に永続化されます：

**本番環境:**

- ボリューム: `m-pass_app-db-data`
- コンテナ内: `/app/data/members.db`
- 環境変数: `DB_PATH=/app/data/members.db`

**デバッグ環境:**

- ボリューム: `m-pass_app-debug-db-data`
- コンテナ内: `/app/data-debug/members.db`
- 環境変数: `DB_PATH=/app/data-debug/members.db`

#### ローカル開発環境

- デフォルト: プロジェクトルートに `members.db` が作成される
- `DB_PATH` 環境変数で変更可能

### データベースのバックアップと復元

```bash
# バックアップ（Dockerからホストへコピー）
docker cp m-pass-prod:/app/data/members.db ./backup/members-$(date +%Y%m%d).db
docker cp m-pass-debug:/app/data-debug/members.db ./backup/members-debug-$(date +%Y%m%d).db

# 復元（ホストからDockerへコピー）
docker cp ./backup/members-20251026.db m-pass-prod:/app/data/members.db
docker-compose restart app

# データベースの完全リセット（全データ削除）
docker-compose down -v
docker-compose up -d
```

### CSV 一括登録・ダウンロード機能

**CSV 形式:**

```csv
email,name,affiliation,affiliation_detail,qr_code,created_at
example@example.com,山田太郎,開発部,第一グループ,5a1b,2025/01/15 10:30:00
,"Duff, Brian",教職員,学部,1j9s,2024/11/21 00:00:00
```

**CSV 仕様:**

- RFC 4180 準拠（カンマや改行を含むフィールドはダブルクォートで囲む）
- エスケープ: ダブルクォート内の`"`は`""`に変換
- カラム: `email,name,affiliation,affiliation_detail,qr_code,created_at`

**created_at 形式:**

- `YYYY/MM/DD` - 時刻なし（00:00:00 として登録）
- `YYYY/MM/DD HH:mm:ss` - 時刻あり

**一括登録動作（UPSERT）:**

- QR コードが存在しない → 新規登録
- QR コードが既に存在 → 既存データを上書き更新（後のデータが優先）
- メールアドレスが空 → `tukumanalabmember+id_<qr_code>@gmail.com` を自動生成
- パスワード → メールアドレスと同じ値で bcrypt ハッシュ化

**失敗データ処理:**

- バリデーションエラーやその他のエラーは`failedRows`に記録
- 重複エラー（QR コード、メール）は除外（上書き更新されるため）
- 失敗データは一覧表示され、CSV 形式でコピー可能

**一括ダウンロード:**

- ファイル名: `members_YYYY-MM-DD.csv`
- 日時は時刻付き（`YYYY/MM/DD HH:mm:ss`）で出力
- ダウンロードした CSV をそのまま再アップロード可能

### アンケート機能

登録フォームに「つくまなラボをどうやって知りましたか？」というアンケートを設置。

**設定ファイル**: `lib/survey-config.ts`

- `SURVEY_QUESTION` - 質問文
- `SURVEY_OPTIONS` - 選択肢の配列（`label` と任意の `url` を持つオブジェクト）。`url` を指定すると選択肢の横に新規タブで開くリンクが表示される
- `SURVEY_OTHER_OPTION` - 自由記述欄を表示するトリガーとなる選択肢のラベル値（デフォルト `"その他"`）

選択肢・質問文を変更する場合は `lib/survey-config.ts` のみ編集すればよい。

**データフロー**:

1. 登録フォームで回答 → `howDidYouKnow` として `POST /api/members/register` に送信
2. `pending_members.how_did_you_know` に一時保存
3. メール確認完了（`POST /api/members/verify`）時に `survey_responses` テーブルへ保存
   - 「その他」選択時は `"その他: {自由記述}"` 形式で保存
   - 未回答の場合は保存しない
   - `created_at` はメンバー登録時刻（UTC）を使用

**アンケート集計ページ** (`/admin/survey`):

- 選択肢ごとの横棒グラフ（件数・回答率%）を表示
- 総登録者数・回答あり件数・未回答件数のサマリ
- 開始日・終了日で期間フィルタ（JST 基準）
- 指定期間を反映した CSV ダウンロード（ファイル名: `survey_{startDate}_{endDate}.csv`）

**CSV 形式**:

```csv
member_id,affiliation,how_did_you_know,created_at
6a1b,大学,Web,2026/04/07 10:30:00
6a2c,高等部,その他: 学校の掲示板,2026/04/07 11:00:00
```

### カードテンプレート機能

- SVG テンプレートは`lib/resource/card-template-default.svg`にデフォルトが配置
- 管理画面（`/admin/settings`）からカスタムテンプレートをアップロード可能
- テンプレート内の`NAME`がメンバー名に、`XXXX`が QR コード ID に置き換えられる
- `id="QR"`属性を持つ要素が QR 画像に置き換えられる
- カードは SVG 形式でダウンロード・印刷可能
