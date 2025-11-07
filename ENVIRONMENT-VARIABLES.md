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
# アプリケーション名（OAuth設定やページタイトルで使用）
APP_NAME=つくまなラボメンバーズサイト (LabMem)

# アプリケーションのベースURL（メール内のリンクで使用）
APP_URL=http://localhost:3000

# アプリのホームページURL（OAuth設定やプライバシーポリシーで使用）
APP_HOME_URL=http://localhost:3000

# お問い合わせ用メールアドレス（プライバシーポリシーで表示）
CONTACT_EMAIL=contact@yourdomain.com

# 利用規約のURL（OAuth設定で使用）
TERMS_OF_SERVICE_URL=http://localhost:3000/api/terms-of-service-html
```

#### Gmail OAuth2設定
```env
GMAIL_USER=your-email@gmail.com
GMAIL_CLIENT_ID=xxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxx
GMAIL_REFRESH_TOKEN=1//xxxxx-yyyyy-zzzzz
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

## 本番環境での設定例

```env
# 本番環境
APP_NAME=つくまなラボメンバーズサイト (LabMem)
APP_URL=https://yourdomain.com
APP_HOME_URL=https://yourdomain.com
CONTACT_EMAIL=support@yourdomain.com

# Gmail設定
GMAIL_USER=noreply@yourdomain.com
GMAIL_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
GMAIL_REFRESH_TOKEN=1//04-abcdefghijklmnop

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

# Gmail設定（テスト用）
GMAIL_USER=test@gmail.com
GMAIL_CLIENT_ID=test-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=test-client-secret
GMAIL_REFRESH_TOKEN=test-refresh-token

# データベース
DB_PATH=members-dev.db

# セキュリティ（開発環境では緩和）
ADMIN_ALLOWED_IPS=private
```

## 環境変数の使用箇所

### APP_NAME
- Google OAuth設定の「アプリ名」
- プライバシーポリシーページのタイトル
- 利用規約ページのタイトル
- 各種法的文書での表示名

### APP_HOME_URL
- Google OAuth設定の「アプリのホームページ」
- プライバシーポリシーのリンク

### CONTACT_EMAIL
- プライバシーポリシーページ（`/privacy-policy`）
- 動的HTMLプライバシーポリシー（`/api/privacy-policy-html`）
- 利用規約ページ（`/terms-of-service`）
- 動的HTML利用規約（`/api/terms-of-service-html`）
- メール送信時の送信者情報

### TERMS_OF_SERVICE_URL
- Google OAuth設定の「利用規約」
- 各種法的文書へのリンク

### APP_URL
- メール内のリンク生成
- QRコード生成時のベースURL

## Google OAuth設定との連携

Google Cloud ConsoleのOAuth同意画面では、以下のように設定してください：

```
アプリ名: [APP_NAMEの値]
アプリのホームページ: [APP_HOME_URLの値]
アプリ プライバシー ポリシー: [APP_URL]/api/privacy-policy-html
利用規約: [TERMS_OF_SERVICE_URLの値]
デベロッパーの連絡先情報: [CONTACT_EMAILの値]
```

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
   printenv | grep -E "(APP_NAME|APP_URL|APP_HOME_URL|CONTACT_|GMAIL_USER)"
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