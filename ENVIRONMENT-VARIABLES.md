# 環境変数設定ガイド

M-Passアプリケーションで使用する環境変数の設定方法について説明します。

## 基本設定

### 1. 環境変数ファイルの作成

```bash
# .env.exampleをコピーして.envファイルを作成
cp .env.example .env
```

### 2. 必須の環境変数

#### アプリケーション基本情報
```env
# アプリケーション名（メールの差出人名やページタイトルで使用）
APP_NAME=つくまなラボメンバーズサイト (LabMem)

# アプリケーションのベースURL（メール内のリンクで使用）
APP_URL=http://localhost:3000

# アプリのホームページURL（プライバシーポリシーで使用）
APP_HOME_URL=http://localhost:3000

# お問い合わせ用メールアドレス（プライバシーポリシーで表示）
CONTACT_EMAIL=contact@yourdomain.com

# 利用規約のURL
TERMS_OF_SERVICE_URL=http://localhost:3000/api/terms-of-service-html
```

#### メール送信設定（Resend）
```env
# Resend の API キー（https://resend.com/api-keys で発行）
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
# 送信元アドレス（Resend でドメイン認証済みのアドレス）
MAIL_FROM=noreply@yourdomain.com
```

#### データベース設定
```env
DB_PATH=members.db
```

#### 管理者設定
```env
# 管理者パスワードのハッシュ値（オプション）
# ADMIN_PASSWORD_HASH=$2b$10$eHFkKLHLdUjcLwds5foX..qQ15MU5LY.by7CSpJLIo76BYy4UeK4K

# 管理者アクセスを許可するIPアドレス範囲
ADMIN_ALLOWED_IPS=private
```

#### 自動デプロイ設定（本番サーバーのみ）
```env
# GitHub Actions から /api/deploy を呼ぶときの共有シークレット
# GitHub リポジトリの Secret DEPLOY_SECRET と同じ値にする（openssl rand -hex 32 などで生成）
# 未設定の場合 /api/deploy は無効（503 を返す）
DEPLOY_SECRET=

# ビルド成果物（GitHub Actions の artifact）を取得するための GitHub トークン
# fine-grained token: 対象リポジトリ tukumanalab/m-pass、権限 Actions: Read-only のみ
GITHUB_ARTIFACT_TOKEN=
```

詳細は [DEPLOY.md](DEPLOY.md) を参照してください。

## 本番環境での設定例

```env
# 本番環境
APP_NAME=つくまなラボメンバーズサイト (LabMem)
APP_URL=https://yourdomain.com
APP_HOME_URL=https://yourdomain.com
CONTACT_EMAIL=support@yourdomain.com

# メール送信設定（Resend）
RESEND_API_KEY=re_abcdefghijklmnopqrstuvwxyz
MAIL_FROM=noreply@yourdomain.com

# データベース
DB_PATH=/app/data/members.db

# セキュリティ
ADMIN_PASSWORD_HASH=$2b$10$realHashValueHere
ADMIN_ALLOWED_IPS=203.0.113.0/24,198.51.100.50
```

## 開発環境での設定例

```env
# 開発環境
APP_NAME=つくまなラボメンバーズサイト (LabMem) [DEV]
APP_URL=http://localhost:3000
APP_HOME_URL=http://localhost:3000
CONTACT_EMAIL=dev@localhost
TERMS_OF_SERVICE_URL=http://localhost:3000/api/terms-of-service-html

# メール送信設定（テスト用）
# ドメイン未認証の場合、Resend はアカウント所有者のアドレス宛にのみ送信できます
RESEND_API_KEY=re_test_xxxxxxxx
MAIL_FROM=onboarding@resend.dev

# データベース
DB_PATH=members-dev.db

# セキュリティ（開発環境では緩和）
ADMIN_ALLOWED_IPS=private
```

## 環境変数の使用箇所

### APP_NAME
- メールの差出人名
- プライバシーポリシーページのタイトル
- 利用規約ページのタイトル
- 各種法的文書での表示名

### APP_HOME_URL
- プライバシーポリシーのリンク

### CONTACT_EMAIL
- プライバシーポリシーページ（`/privacy-policy`）
- 動的HTMLプライバシーポリシー（`/api/privacy-policy-html`）
- 利用規約ページ（`/terms-of-service`）
- 動的HTML利用規約（`/api/terms-of-service-html`）
- メール送信時の送信者情報

### TERMS_OF_SERVICE_URL
- 各種法的文書へのリンク

### APP_URL
- メール内のリンク生成
- QRコード生成時のベースURL

## 環境変数の検証

アプリケーション起動時に以下のコマンドで環境変数を確認できます：

```bash
# 設定されている環境変数を確認（セキュリティ情報は除く）
node scripts/check-env.js
```

## セキュリティ注意事項

1. **本番環境では.envファイルを適切に保護**
   ```bash
   chmod 600 .env
   ```

2. **Gitにはコミットしないでください**
   ```bash
   # .gitignoreに以下が含まれていることを確認
   .env
   .env.local
   .env.production
   ```

3. **本番環境では環境変数サービスを使用**
   - クラウドプロバイダーの環境変数サービス
   - CI/CDパイプラインのシークレット管理
   - Dockerのsecrets機能

## トラブルシューティング

### 環境変数が反映されない場合

1. **ファイル名を確認**
   ```bash
   ls -la .env*
   ```

2. **アプリケーションを再起動**
   ```bash
   npm run dev
   ```

3. **環境変数の値を確認**
   ```bash
   # 開発環境でのみ実行（本番では実行しないでください）
   printenv | grep -E "(APP_NAME|APP_URL|APP_HOME_URL|CONTACT_|MAIL_FROM)"
   ```

### プライバシーポリシーが正しく表示されない場合

1. **環境変数の設定確認**
   ```bash
   echo $APP_NAME
   echo $CONTACT_EMAIL
   echo $APP_HOME_URL
   ```

2. **APIルートの動作確認**
   ```bash
   curl http://localhost:3000/api/privacy-policy-html
   ```

3. **Next.jsのビルド再実行**
   ```bash
   npm run build
   npm run start
   ```